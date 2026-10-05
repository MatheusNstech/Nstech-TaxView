"""Carga única da planilha "Acompanhamento PERDCOMP" em perdcomp_processos.

Upsert por número do PER/DCOMP: rodar de novo atualiza sem duplicar.

Uso:
  cd backend
  ..\\.venv\\Scripts\\python.exe -m scripts.seed_perdcomp "..\\Acompanhamento PERDCOMP (1).xlsx"
"""

from __future__ import annotations

import sys
import unicodedata
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.core.config import get_settings  # noqa: E402

TABLE = "perdcomp_processos"

# Cabeçalho da planilha (normalizado) -> coluna da tabela
HEADER_MAP = {
    "per/dcomp": "perdcomp",
    "processo": "processo",
    "empresa": "empresa",
    "tributo/credito": "tributo_credito",
    "periodo": "periodo",
    "valor do pedido": "valor_pedido",
    "status": "status",
    "observacoes": "observacoes",
    "prazo para cumprimento": "prazo_cumprimento",
    "data-base / ciencia": "data_base_ciencia",
    "data limite": "data_limite",
    "providencia / observacao do prazo": "providencia",
}


def _norm(text: object) -> str:
    raw = unicodedata.normalize("NFKD", str(text or ""))
    return "".join(c for c in raw if not unicodedata.combining(c)).strip().casefold()


def _text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _money(value: object) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    text = str(value).replace("R$", "").replace(" ", "").strip()
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return float(Decimal(text).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    except Exception:
        return None


def _date(value: object) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def read_rows(path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb.worksheets[0]
    rows_iter = ws.iter_rows(values_only=True)
    header = next(rows_iter)
    columns: dict[int, str] = {}
    for idx, name in enumerate(header):
        key = HEADER_MAP.get(_norm(name))
        if key:
            columns[idx] = key
    missing = set(HEADER_MAP.values()) - set(columns.values())
    if "perdcomp" in missing:
        raise SystemExit("Coluna 'PER/DCOMP' não encontrada no cabeçalho")
    if missing:
        print(f"Aviso: colunas ausentes na planilha: {sorted(missing)}")

    out: list[dict] = []
    for raw in rows_iter:
        record: dict = {}
        for idx, key in columns.items():
            value = raw[idx] if idx < len(raw) else None
            if key == "valor_pedido":
                record[key] = _money(value)
            elif key == "data_limite":
                record[key] = _date(value)
            else:
                record[key] = _text(value)
        if not record.get("perdcomp"):
            continue
        out.append(record)
    wb.close()
    return out


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 1
    path = Path(argv[1]).expanduser().resolve()
    if not path.exists():
        print(f"Arquivo não encontrado: {path}")
        return 1

    settings = get_settings()
    if not settings.supabase_service_role_key or settings.supabase_service_role_key.startswith(
        "your-"
    ):
        print("Configure SUPABASE_SERVICE_ROLE_KEY")
        return 1

    rows = read_rows(path)
    if not rows:
        print("Nenhum processo encontrado na planilha")
        return 1

    admin = get_admin_client(settings)
    admin.table(TABLE).upsert(rows, on_conflict="perdcomp").execute()
    total = sum(r["valor_pedido"] or 0 for r in rows)
    print(f"{len(rows)} processos carregados em {TABLE} (valor total R$ {total:,.2f})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
