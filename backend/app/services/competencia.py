from __future__ import annotations

from datetime import date
from typing import Any

from dateutil.relativedelta import relativedelta
from supabase import Client

from app.services.db import fetch_all
from app.services.obrigacao_responsaveis import add_responsaveis_bulk, links_by_obrigacao
from app.services.status_engine import compute_prazo


def gerar_competencia(
    client: Client,
    competencia_destino: date,
    competencia_origem: date | None = None,
) -> dict[str, Any]:
    if competencia_origem is None:
        competencia_origem = competencia_destino - relativedelta(months=1)

    origem = fetch_all(
        lambda: client.table("obrigacoes")
        .select(
            "id,empresa_id,atividade_id,responsavel_id,"
            "atividades_modelo(dia_prazo_legal,dia_prazo_fiscal)"
        )
        .eq("competencia", competencia_origem.isoformat())
        .order("id")
    )

    if not origem:
        empresas = fetch_all(
            lambda: client.table("empresas").select("id").eq("ativa", True).order("id")
        )
        atividades = fetch_all(
            lambda: client.table("atividades_modelo").select("*").eq("ativa", True).order("id")
        )
        for empresa in empresas:
            for atividade in atividades:
                origem.append(
                    {
                        "empresa_id": empresa["id"],
                        "atividade_id": atividade["id"],
                        "responsavel_id": None,
                        "atividades_modelo": {
                            "dia_prazo_legal": atividade.get("dia_prazo_legal"),
                            "dia_prazo_fiscal": atividade.get("dia_prazo_fiscal"),
                        },
                    }
                )

    existing = fetch_all(
        lambda: client.table("obrigacoes")
        .select("id,empresa_id,atividade_id")
        .eq("competencia", competencia_destino.isoformat())
        .order("id")
    )
    existing_keys = {(e["empresa_id"], e["atividade_id"]) for e in existing}

    to_create: list[dict[str, Any]] = []
    source_by_key: dict[tuple[str, str], str] = {}
    ignored = 0
    for row in origem:
        key = (row["empresa_id"], row["atividade_id"])
        if key in existing_keys:
            ignored += 1
            continue
        if row.get("id"):
            source_by_key[(str(key[0]), str(key[1]))] = str(row["id"])
        modelo = row.get("atividades_modelo") or {}
        to_create.append(
            {
                "empresa_id": row["empresa_id"],
                "atividade_id": row["atividade_id"],
                "responsavel_id": row.get("responsavel_id"),
                "competencia": competencia_destino.isoformat(),
                "prazo_legal": (
                    compute_prazo(competencia_destino, modelo.get("dia_prazo_legal")).isoformat()
                    if modelo.get("dia_prazo_legal")
                    else None
                ),
                "prazo_fiscal": (
                    compute_prazo(competencia_destino, modelo.get("dia_prazo_fiscal")).isoformat()
                    if modelo.get("dia_prazo_fiscal")
                    else None
                ),
                "status": "PENDENTE",
            }
        )

    created_rows: list[dict[str, Any]] = []
    if to_create:
        chunk_size = 100
        for i in range(0, len(to_create), chunk_size):
            res = client.table("obrigacoes").upsert(
                to_create[i : i + chunk_size],
                on_conflict="empresa_id,atividade_id,competencia",
                ignore_duplicates=True,
            ).execute()
            created_rows.extend(res.data or [])

    source_links = links_by_obrigacao(client, source_by_key.values())
    co_links: list[tuple[str, str]] = []
    for new_row in created_rows:
        source_id = source_by_key.get((str(new_row["empresa_id"]), str(new_row["atividade_id"])))
        for rid in source_links.get(source_id or "", set()):
            co_links.append((str(new_row["id"]), rid))
    add_responsaveis_bulk(client, co_links)

    return {
        "criadas": len(to_create),
        "ignoradas": ignored,
        "competencia_destino": competencia_destino,
        "competencia_origem": competencia_origem,
    }
