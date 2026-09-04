from __future__ import annotations

import csv
import io
import re
from datetime import date
from typing import Any

from supabase import Client

from app.services.status_engine import compute_prazo

COMPETENCIA_DEFAULT = date(2026, 8, 1)
COMPETENCIA_SUFFIX_RE = re.compile(r"\s*\((\d{2})/(\d{4})\)\s*$")


def normalize_atividade_nome(raw: str) -> tuple[str, date | None]:
    text = " ".join(raw.split())
    match = COMPETENCIA_SUFFIX_RE.search(text)
    competencia: date | None = None
    if match:
        month = int(match.group(1))
        year = int(match.group(2))
        competencia = date(year, month, 1)
        text = COMPETENCIA_SUFFIX_RE.sub("", text).strip()
    return text, competencia


def parse_bool_pt(value: str) -> bool:
    return value.strip().upper() in {"VERDADEIRO", "TRUE", "1", "SIM"}


def _upsert_map(
    client: Client,
    table: str,
    key_field: str,
    rows: list[dict[str, Any]],
) -> dict[str, str]:
    result: dict[str, str] = {}
    if not rows:
        return result
    # fetch existing
    existing = client.table(table).select(f"id,{key_field}").execute().data or []
    for item in existing:
        result[str(item[key_field])] = item["id"]

    to_insert = [r for r in rows if r[key_field] not in result]
    if to_insert:
        inserted = client.table(table).upsert(to_insert, on_conflict=key_field).execute().data or []
        for item in inserted:
            result[str(item[key_field])] = item["id"]
        # refresh if upsert didn't return
        if len(result) < len(rows):
            existing = client.table(table).select(f"id,{key_field}").execute().data or []
            for item in existing:
                result[str(item[key_field])] = item["id"]
    return result


def import_csv_bytes(
    client: Client,
    content: bytes,
    competencia: date | None = None,
) -> dict[str, Any]:
    text = content.decode("cp1252")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    if reader.fieldnames is None:
        raise ValueError("CSV sem cabeçalho")

    # Normalize headers (encoding may vary slightly)
    field_map = {h: h for h in reader.fieldnames}

    def get(row: dict[str, str], *candidates: str) -> str:
        for key in candidates:
            for actual in field_map:
                if actual.lower().replace("ã", "a").replace("ç", "c") == key.lower().replace(
                    "ã", "a"
                ).replace("ç", "c"):
                    return (row.get(actual) or "").strip()
            if key in row:
                return (row.get(key) or "").strip()
        # fuzzy contains
        for actual, value in row.items():
            for key in candidates:
                if key.lower()[:5] in (actual or "").lower():
                    return (value or "").strip()
        return ""

    empresas_rows: dict[str, dict[str, Any]] = {}
    atividades_rows: dict[str, dict[str, Any]] = {}
    responsaveis_rows: dict[str, dict[str, Any]] = {}
    obrigacao_specs: list[dict[str, Any]] = []

    default_comp = competencia or COMPETENCIA_DEFAULT

    for row in reader:
        cnpj = get(row, "CNPJ")
        razao = get(row, "Razão Social", "Razao Social")
        bu = get(row, "BU") or "N/A"
        apuracao = parse_bool_pt(get(row, "Apuração", "Apuracao") or "VERDADEIRO")
        atividade_raw = get(row, "Atividade")
        responsavel = get(row, "Responsável", "Responsavel")
        if not cnpj or not atividade_raw:
            continue

        nome_atividade, _comp_from_name = normalize_atividade_nome(atividade_raw)
        # Sufixo (MM/AAAA) no nome da atividade é referência da obrigação,
        # não a competência do cronograma — usar sempre o parâmetro/default.
        comp = default_comp

        empresas_rows[cnpj] = {
            "cnpj": cnpj,
            "razao_social": razao or cnpj,
            "bu": bu,
            "ativa": True,
        }
        atividades_rows[nome_atividade] = {
            "nome": nome_atividade,
            "requer_apuracao": apuracao,
            "recorrencia": "mensal",
            "ativa": True,
            "dia_prazo_legal": 20,
            "dia_prazo_fiscal": 15,
        }
        if responsavel:
            responsaveis_rows[responsavel] = {
                "nome": responsavel,
                "ativo": True,
            }

        obrigacao_specs.append(
            {
                "cnpj": cnpj,
                "atividade": nome_atividade,
                "responsavel": responsavel or None,
                "competencia": comp.isoformat(),
            }
        )

    empresa_ids = _upsert_map(client, "empresas", "cnpj", list(empresas_rows.values()))
    atividade_ids = _upsert_map(
        client, "atividades_modelo", "nome", list(atividades_rows.values())
    )
    responsavel_ids = _upsert_map(
        client, "responsaveis", "nome", list(responsaveis_rows.values())
    )

    # load atividade prazo days
    atividades_db = {
        a["id"]: a
        for a in (client.table("atividades_modelo").select("*").execute().data or [])
    }

    payload: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for spec in obrigacao_specs:
        empresa_id = empresa_ids[spec["cnpj"]]
        atividade_id = atividade_ids[spec["atividade"]]
        key = (empresa_id, atividade_id, spec["competencia"])
        if key in seen:
            continue
        seen.add(key)
        atividade = atividades_db.get(atividade_id, {})
        comp_date = date.fromisoformat(spec["competencia"])
        payload.append(
            {
                "empresa_id": empresa_id,
                "atividade_id": atividade_id,
                "responsavel_id": responsavel_ids.get(spec["responsavel"])
                if spec["responsavel"]
                else None,
                "competencia": spec["competencia"],
                "prazo_legal": (
                    compute_prazo(comp_date, atividade.get("dia_prazo_legal")).isoformat()
                    if atividade.get("dia_prazo_legal")
                    else None
                ),
                "prazo_fiscal": (
                    compute_prazo(comp_date, atividade.get("dia_prazo_fiscal")).isoformat()
                    if atividade.get("dia_prazo_fiscal")
                    else None
                ),
                "status": "PENDENTE",
            }
        )

    created = 0
    if payload:
        # upsert in chunks
        chunk_size = 100
        for i in range(0, len(payload), chunk_size):
            chunk = payload[i : i + chunk_size]
            client.table("obrigacoes").upsert(
                chunk,
                on_conflict="empresa_id,atividade_id,competencia",
            ).execute()
            created += len(chunk)

    return {
        "empresas": len(empresa_ids),
        "atividades": len(atividade_ids),
        "responsaveis": len(responsavel_ids),
        "obrigacoes": created,
        "competencia": default_comp,
    }
