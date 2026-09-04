from __future__ import annotations

from datetime import date
from typing import Any

from dateutil.relativedelta import relativedelta
from supabase import Client

from app.services.notifications import notify_responsavel_of_obrigacao
from app.services.status_engine import compute_prazo, normalize_status


def mark_overdue(client: Client, today: date | None = None) -> dict[str, int]:
    today = today or date.today()
    rows = (
        client.table("obrigacoes")
        .select("id,status,prazo_legal,prazo_fiscal,data_entrega")
        .neq("status", "ENTREGUE")
        .execute()
        .data
        or []
    )
    updates = 0
    notificacoes = 0
    for row in rows:
        new_status = normalize_status(
            row["status"],
            date.fromisoformat(row["prazo_legal"]) if row.get("prazo_legal") else None,
            date.fromisoformat(row["prazo_fiscal"]) if row.get("prazo_fiscal") else None,
            date.fromisoformat(row["data_entrega"]) if row.get("data_entrega") else None,
            today=today,
        )
        if new_status != row["status"]:
            client.table("obrigacoes").update({"status": new_status}).eq("id", row["id"]).execute()
            updates += 1
            if new_status == "ATRASADO" and row["status"] != "ATRASADO":
                notificacoes += notify_responsavel_of_obrigacao(
                    client,
                    obrigacao_id=row["id"],
                    tipo="ATRASADO",
                    titulo="Obrigação atrasada",
                    corpo="O prazo legal/fiscal foi ultrapassado.",
                    dedupe_same_day=True,
                )
    return {"atualizadas": updates, "notificacoes_criadas": notificacoes}


def gerar_competencia(
    client: Client,
    competencia_destino: date,
    competencia_origem: date | None = None,
) -> dict[str, Any]:
    if competencia_origem is None:
        competencia_origem = competencia_destino - relativedelta(months=1)

    origem = (
        client.table("obrigacoes")
        .select(
            "empresa_id,atividade_id,responsavel_id,"
            "atividades_modelo(dia_prazo_legal,dia_prazo_fiscal)"
        )
        .eq("competencia", competencia_origem.isoformat())
        .execute()
        .data
        or []
    )

    if not origem:
        empresas = client.table("empresas").select("id").eq("ativa", True).execute().data or []
        atividades = (
            client.table("atividades_modelo").select("*").eq("ativa", True).execute().data or []
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

    existing = (
        client.table("obrigacoes")
        .select("empresa_id,atividade_id")
        .eq("competencia", competencia_destino.isoformat())
        .execute()
        .data
        or []
    )
    existing_keys = {(e["empresa_id"], e["atividade_id"]) for e in existing}

    to_create: list[dict[str, Any]] = []
    ignored = 0
    for row in origem:
        key = (row["empresa_id"], row["atividade_id"])
        if key in existing_keys:
            ignored += 1
            continue
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

    if to_create:
        chunk_size = 100
        for i in range(0, len(to_create), chunk_size):
            client.table("obrigacoes").insert(to_create[i : i + chunk_size]).execute()

    return {
        "criadas": len(to_create),
        "ignoradas": ignored,
        "competencia_destino": competencia_destino,
        "competencia_origem": competencia_origem,
    }
