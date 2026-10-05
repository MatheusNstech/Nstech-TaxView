"""Recarga do cronograma a partir de "Cronograma para input.xlsx".

Apaga todas as obrigações e as tarefas avulsas de todos, menos as do Matheus, e importa a
planilha de novo. Sem --aplicar só mostra o que faria (dry-run).

Uso:
  cd backend
  ..\\.venv\\Scripts\\python.exe -m scripts.recarregar_cronograma
  ..\\.venv\\Scripts\\python.exe -m scripts.recarregar_cronograma --aplicar
"""

from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.services.csv_import import (  # noqa: E402
    _import_table_rows,
    _parse_iso_date,
    normalize_atividade_nome,
    normalize_cnpj,
    rows_from_xlsx,
    split_responsaveis,
)
from app.services.db import fetch_all  # noqa: E402

DEFAULT_XLSX = ROOT.parent / "Cronograma para input.xlsx"
BACKUP_DIR = Path(__file__).resolve().parent / "backups"
MATHEUS_RESP_ID = "1ceb33b2-3fc1-42ff-a0ab-d2baf6642689"

# Apelidos usados na planilha -> nome cadastrado em responsaveis
RESPONSAVEL_ALIASES = {
    "fla": "Flávia",
    "flo": "Flávia",
    "glau": "Glaucia",
    "sol": "Solange",
}
ATIVIDADE_ALIASES = {
    "MIT / DCFTWEB": "MIT / DCTFWEB",
}


def _key(text: str) -> str:
    norm = unicodedata.normalize("NFKD", text.strip().lower())
    return "".join(ch for ch in norm if not unicodedata.combining(ch))


def _col(row: dict[str, str], name: str) -> str:
    for header, value in row.items():
        if _key(header) == _key(name):
            return value
    return ""


def _set_col(row: dict[str, str], name: str, value: str) -> None:
    for header in row:
        if _key(header) == _key(name):
            row[header] = value
            return
    row[name] = value


def normalizar_linhas(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for raw in rows:
        row = dict(raw)
        nomes = [
            RESPONSAVEL_ALIASES.get(_key(n), n) for n in split_responsaveis(_col(row, "Responsável"))
        ]
        _set_col(row, "Responsável", "/".join(nomes))
        atividade, _ = normalize_atividade_nome(_col(row, "Atividade"))
        _set_col(row, "Atividade", ATIVIDADE_ALIASES.get(atividade, atividade))
        out.append(row)
    return out


def relatorio(client: Any, rows: list[dict[str, str]]) -> dict[str, Any]:
    empresas = {e["cnpj"] for e in fetch_all(lambda: client.table("empresas").select("cnpj").order("id"))}
    atividades = {
        a["nome"] for a in fetch_all(lambda: client.table("atividades_modelo").select("nome").order("id"))
    }
    responsaveis = {
        r["nome"] for r in fetch_all(lambda: client.table("responsaveis").select("nome").order("id"))
    }
    cnpjs = {normalize_cnpj(_col(r, "CNPJ")) for r in rows}
    nomes_ativ = {_col(r, "Atividade") for r in rows}
    nomes_resp = {n for r in rows for n in split_responsaveis(_col(r, "Responsável"))}
    competencias = Counter(
        str(_parse_iso_date(_col(r, "Competência")) or "(inválida)") for r in rows
    )
    multi = sum(1 for r in rows if len(split_responsaveis(_col(r, "Responsável"))) > 1)

    obrigacoes = fetch_all(lambda: client.table("obrigacoes").select("id").order("id"))
    tarefas = fetch_all(lambda: client.table("tarefas").select("id,responsavel_id").order("id"))
    tarefas_matheus = [t for t in tarefas if t["responsavel_id"] == MATHEUS_RESP_ID]
    return {
        "linhas": len(rows),
        "competencias": dict(sorted(competencias.items())),
        "linhas_com_varios_responsaveis": multi,
        "empresas_na_planilha": len(cnpjs),
        "empresas_sem_cadastro (serão criadas)": sorted(cnpjs - empresas),
        "atividades_novas (serão criadas)": sorted(nomes_ativ - atividades),
        "responsaveis_novos (serão criados)": sorted(nomes_resp - responsaveis),
        "apagar_obrigacoes": len(obrigacoes),
        "apagar_tarefas_dos_outros": len(tarefas) - len(tarefas_matheus),
        "manter_tarefas_matheus": len(tarefas_matheus),
    }


def backup(client: Any) -> Path:
    BACKUP_DIR.mkdir(exist_ok=True)
    data = {
        table: fetch_all(lambda table=table: client.table(table).select("*").order("id"))
        for table in ("obrigacoes", "obrigacao_responsaveis", "tarefas")
    }
    path = BACKUP_DIR / f"cronograma_{datetime.now():%Y%m%d_%H%M%S}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    return path


def _delete_ids(client: Any, table: str, ids: list[str]) -> None:
    chunk_size = 100
    for i in range(0, len(ids), chunk_size):
        client.table(table).delete().in_("id", ids[i : i + chunk_size]).execute()


def aplicar(client: Any, rows: list[dict[str, str]]) -> dict[str, Any]:
    matheus = (
        client.table("responsaveis").select("id,nome").eq("id", MATHEUS_RESP_ID).execute().data or []
    )
    if not matheus or "matheus" not in _key(matheus[0]["nome"]):
        raise SystemExit(f"Responsável {MATHEUS_RESP_ID} não é o Matheus; abortando.")

    path = backup(client)
    print(f"Backup salvo em {path}")

    obrigacoes = fetch_all(lambda: client.table("obrigacoes").select("id").order("id"))
    _delete_ids(client, "obrigacoes", [o["id"] for o in obrigacoes])
    tarefas = fetch_all(lambda: client.table("tarefas").select("id,responsavel_id").order("id"))
    _delete_ids(
        client,
        "tarefas",
        [t["id"] for t in tarefas if t["responsavel_id"] != MATHEUS_RESP_ID],
    )
    return _import_table_rows(client, rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("planilha", nargs="?", default=str(DEFAULT_XLSX))
    parser.add_argument("--aplicar", action="store_true", help="grava no banco (padrão: dry-run)")
    args = parser.parse_args()

    get_settings()
    client = get_admin_client()
    rows = normalizar_linhas(rows_from_xlsx(Path(args.planilha).read_bytes()))

    print(json.dumps(relatorio(client, rows), ensure_ascii=False, indent=2))
    if not args.aplicar:
        print("\nDry-run: nada foi gravado. Rode com --aplicar para executar.")
        return
    print(json.dumps(aplicar(client, rows), ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
