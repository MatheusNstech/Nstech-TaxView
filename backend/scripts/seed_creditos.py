"""Importa todos os .xlsb/.xlsx da pasta Creditos/ (match por CNPJ).

Uso:
  cd backend
  ..\\.venv\\Scripts\\python.exe -m scripts.seed_creditos
  ..\\.venv\\Scripts\\python.exe -m scripts.seed_creditos "..\\Creditos"
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.services.creditos_import import parse_creditos_path, so_digitos_cnpj  # noqa: E402
from app.services.creditos_persist import apply_import  # noqa: E402
from app.services.db import fetch_all  # noqa: E402


def _empresas_by_cnpj(client) -> dict[str, dict]:
    rows = fetch_all(
        lambda: client.table("empresas").select("id,cnpj,razao_social,ativa").order("id")
    )
    out: dict[str, dict] = {}
    for r in rows:
        digits = so_digitos_cnpj(r.get("cnpj") or "")
        if len(digits) == 14:
            out[digits] = r
    return out


def main(folder: Path | None = None) -> int:
    settings = get_settings()
    if not settings.supabase_url:
        print("SUPABASE_URL não configurada")
        return 1
    client = get_admin_client(settings)
    base = folder or (REPO / "Creditos")
    if not base.is_dir():
        print(f"Pasta não encontrada: {base}")
        return 1

    files = sorted(
        [*base.glob("*.xlsb"), *base.glob("*.xlsx")],
        key=lambda p: p.name.lower(),
    )
    if not files:
        print(f"Nenhum .xlsb/.xlsx em {base}")
        return 1

    empresas = _empresas_by_cnpj(client)
    print(f"Empresas com CNPJ: {len(empresas)} | Arquivos: {len(files)}")
    print("-" * 60)

    ok = 0
    skip = 0
    fail = 0
    for path in files:
        try:
            parsed = parse_creditos_path(path)
        except Exception as exc:  # noqa: BLE001
            print(f"FAIL  {path.name}: parse — {exc}")
            fail += 1
            continue

        if not parsed.cnpj:
            print(f"SKIP  {path.name}: CNPJ não encontrado no arquivo")
            skip += 1
            continue

        emp = empresas.get(parsed.cnpj)
        if not emp:
            print(
                f"SKIP  {path.name}: CNPJ {parsed.cnpj} "
                f"({parsed.razao_social or '?'}) sem empresa no banco"
            )
            skip += 1
            continue

        try:
            result = apply_import(client, empresa_id=emp["id"], parsed=parsed, user_id=None)
        except Exception as exc:  # noqa: BLE001
            print(f"FAIL  {path.name} → {emp['razao_social']}: {exc}")
            fail += 1
            continue

        warns = result.get("warnings") or []
        print(
            f"OK    {path.name} → {emp['razao_social']} "
            f"| créditos={result['imported']} selic={result['selic']} "
            f"na_cons={result['na_consolidada']} conta={result.get('conta_contabil') or '—'}"
        )
        for w in warns[:5]:
            print(f"        ! {w}")
        if len(warns) > 5:
            print(f"        ! … +{len(warns) - 5} avisos")
        ok += 1

    print("-" * 60)
    print(f"Concluído: {ok} ok, {skip} skip, {fail} fail")
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    arg = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    raise SystemExit(main(arg))
