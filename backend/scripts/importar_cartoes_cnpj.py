"""Carga dos PDFs de Cartão CNPJ de uma pasta para o bucket cartoes-cnpj.

A empresa é identificada pelo CNPJ escrito dentro do PDF, não pelo nome do arquivo.
Sem --aplicar só mostra o que faria.

Uso:
  cd backend
  .\\.venv\\Scripts\\python.exe -m scripts.importar_cartoes_cnpj "<pasta>" [--aplicar]
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.services import cartao_cnpj  # noqa: E402
from app.services.db import fetch_all  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("pasta", type=Path)
    parser.add_argument("--aplicar", action="store_true", help="grava no Supabase")
    args = parser.parse_args()

    client = get_admin_client()
    empresas = fetch_all(
        lambda: client.table("empresas").select("id,cnpj,razao_social").order("id")
    )
    por_cnpj = {cartao_cnpj.so_digitos(e["cnpj"]): e for e in empresas}

    escolhidos: dict[str, Path] = {}
    sem_empresa: list[tuple[Path, str | None]] = []
    duplicados: list[tuple[str, Path, Path]] = []
    for pdf in sorted(args.pasta.glob("*.pdf")):
        content = pdf.read_bytes()
        lido = cartao_cnpj.cnpj_do_pdf(content)
        empresa = por_cnpj.get(cartao_cnpj.so_digitos(lido or ""))
        if not cartao_cnpj.is_pdf(content) or not empresa:
            sem_empresa.append((pdf, lido))
            continue
        anterior = escolhidos.get(empresa["id"])
        if anterior:
            novo, velho = sorted([anterior, pdf], key=lambda p: p.stat().st_mtime, reverse=True)
            duplicados.append((empresa["cnpj"], novo, velho))
            escolhidos[empresa["id"]] = novo
        else:
            escolhidos[empresa["id"]] = pdf

    por_id = {e["id"]: e for e in empresas}
    print(f"{len(escolhidos)} cartões casados com empresas:")
    for empresa_id, pdf in sorted(escolhidos.items(), key=lambda kv: por_id[kv[0]]["razao_social"]):
        e = por_id[empresa_id]
        print(f"  {pdf.name:<28} -> {e['cnpj']}  {e['razao_social']}")
    if duplicados:
        print("\nMais de um arquivo para o mesmo CNPJ (fica o mais recente):")
        for cnpj, novo, velho in duplicados:
            print(f"  {cnpj}: usa {novo.name}, ignora {velho.name}")
    if sem_empresa:
        print("\nArquivos sem empresa cadastrada:")
        for pdf, lido in sem_empresa:
            print(f"  {pdf.name} (CNPJ lido: {lido or 'nenhum'})")
    faltando = [e for e in empresas if e["id"] not in escolhidos]
    if faltando:
        print("\nEmpresas sem cartão na pasta:")
        for e in sorted(faltando, key=lambda e: e["razao_social"]):
            print(f"  {e['cnpj']}  {e['razao_social']}")

    if not args.aplicar:
        print("\nSimulação: nada foi gravado. Rode com --aplicar para enviar.")
        return 0

    bucket = client.storage.from_(cartao_cnpj.BUCKET)
    agora = datetime.now(UTC).isoformat()
    for empresa_id, pdf in escolhidos.items():
        path = cartao_cnpj.storage_path(empresa_id)
        bucket.upload(path, pdf.read_bytes(), {"content-type": "application/pdf", "upsert": "true"})
        client.table("empresas").update(
            {"cartao_cnpj_path": path, "cartao_cnpj_atualizado_em": agora}
        ).eq("id", empresa_id).execute()
    print(f"\n{len(escolhidos)} cartões enviados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
