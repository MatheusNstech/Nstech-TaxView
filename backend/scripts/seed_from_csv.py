"""Seed/import CSV using service role credentials from backend/.env"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.services.csv_import import import_csv_bytes  # noqa: E402


def main() -> None:
    csv_path = Path(__file__).resolve().parents[2] / "Cronograma_TAX_Nstech.csv"
    if not csv_path.exists():
        raise SystemExit(f"CSV não encontrado: {csv_path}")
    get_settings()  # validate env
    client = get_admin_client()
    result = import_csv_bytes(client, csv_path.read_bytes())
    print(result)


if __name__ == "__main__":
    main()
