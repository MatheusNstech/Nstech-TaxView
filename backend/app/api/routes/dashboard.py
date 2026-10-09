from collections import Counter
from datetime import date, timedelta
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends
from supabase import Client

from app.core.auth import AuthUser, get_current_user, get_db_client
from app.core.clock import today_br
from app.schemas.models import DashboardSummary
from app.services.db import fetch_all
from app.services.obrigacao_responsaveis import (
    apply_responsavel_filter,
    pop_responsaveis,
    select_with_responsavel_filter,
)
from app.services.scope import effective_responsavel_id
from app.services.status_engine import (
    as_br_date,
    is_delivered,
    normalize_status,
    urgencia_label,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _empty_summary() -> DashboardSummary:
    return DashboardSummary(
        total=0,
        pendente=0,
        em_andamento=0,
        em_revisao=0,
        entregue=0,
        atrasado=0,
        vence_em_7_dias=0,
        percentual_entregue=0.0,
        por_bu={},
        por_responsavel={},
        capacidade_por_responsavel={},
    )


def _normalize_tarefa_status(row: dict[str, Any], today: date) -> str:
    st = row.get("status") or "PENDENTE"
    if is_delivered(st):
        return "ENTREGUE"
    prazo = date.fromisoformat(row["prazo"]) if row.get("prazo") else None
    if prazo and prazo < (as_br_date(row.get("entrega_original")) or today):
        return "ATRASADO"
    return st


@router.get("/summary", response_model=DashboardSummary)
def summary(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    competencia: date | None = None,
    bu: str | None = None,
    responsavel_id: UUID | None = None,
    atividade_id: UUID | None = None,
):
    scope_rid: str | None = None
    if user.org_wide:
        if user.role == "admin" and responsavel_id:
            scope_rid = str(responsavel_id)
    else:
        scope = effective_responsavel_id(user, client)
        if scope is None:
            return _empty_summary()
        scope_rid = str(scope)

    def build(table: str, columns: str):
        def _query():
            if table == "obrigacoes":
                query = client.table(table).select(
                    select_with_responsavel_filter(columns, scope_rid)
                )
                query = apply_responsavel_filter(query, scope_rid)
            else:
                query = client.table(table).select(columns)
                if scope_rid:
                    query = query.eq("responsavel_id", scope_rid)
            if atividade_id:
                query = query.eq("atividade_id", str(atividade_id))
            if competencia:
                query = query.eq("competencia", competencia.isoformat())
            return query.order("id")

        return _query

    obr_rows = fetch_all(
        build(
            "obrigacoes",
            "id,status,prazo_legal,prazo_fiscal,data_entrega,entrega_original,responsavel_id,"
            "empresas(bu,razao_social),responsaveis(id,nome,capacidade_max),"
            "obrigacao_responsaveis(responsavel_id,responsaveis(id,nome,capacidade_max))",
        )
    )
    tar_rows = fetch_all(
        build(
            "tarefas",
            "id,status,prazo,entrega_original,responsavel_id,"
            "empresas(bu,razao_social),responsaveis(nome,capacidade_max)",
        )
    )

    if bu:
        obr_rows = [
            r for r in obr_rows if (r.get("empresas") or {}).get("bu") == bu
        ]
        tar_rows = [
            r for r in tar_rows if (r.get("empresas") or {}).get("bu") == bu
        ]

    today = today_br()
    limit = today + timedelta(days=7)
    status_counter: Counter[str] = Counter()
    bu_counter: Counter[str] = Counter()
    resp_counter: Counter[str] = Counter()
    capacidade: dict[str, int | None] = {}
    vence_7 = 0

    for row in obr_rows:
        prazo_legal = date.fromisoformat(row["prazo_legal"]) if row.get("prazo_legal") else None
        prazo_fiscal = date.fromisoformat(row["prazo_fiscal"]) if row.get("prazo_fiscal") else None
        entrega_original = as_br_date(row.get("entrega_original"))
        st = normalize_status(
            row.get("status") or "PENDENTE",
            prazo_legal,
            prazo_fiscal,
            date.fromisoformat(row["data_entrega"]) if row.get("data_entrega") else None,
            today=today,
            entrega_original=entrega_original,
        )
        if is_delivered(st):
            st = "ENTREGUE"
        elif (
            st in {"EM_ANDAMENTO", "EM_REVISAO"}
            and urgencia_label(
                st, prazo_legal, prazo_fiscal, today=today, entrega_original=entrega_original
            )
            == "atrasado"
        ):
            # No Kanban segue na coluna; nos painéis conta como atraso.
            st = "ATRASADO"
        status_counter[st] += 1
        bu_counter[(row.get("empresas") or {}).get("bu") or "N/A"] += 1
        # Cada responsável (principal ou co-responsável) carrega a obrigação.
        resps = pop_responsaveis(row, row.pop("responsaveis", None))
        if scope_rid:
            resps = [r for r in resps if str(r.get("id")) == scope_rid]
        for resp in resps or [{}]:
            nome = resp.get("nome") or "Sem responsável"
            resp_counter[nome] += 1
            if nome not in capacidade:
                capacidade[nome] = resp.get("capacidade_max")
        ref = row.get("prazo_fiscal") or row.get("prazo_legal")
        if st != "ENTREGUE" and ref and not row.get("entrega_original"):
            ref_date = date.fromisoformat(ref)
            if today <= ref_date <= limit:
                vence_7 += 1

    for row in tar_rows:
        st = _normalize_tarefa_status(row, today)
        status_counter[st] += 1
        bu_counter[(row.get("empresas") or {}).get("bu") or "N/A"] += 1
        nome = (row.get("responsaveis") or {}).get("nome") or "Sem responsável"
        resp_counter[nome] += 1
        if nome not in capacidade:
            capacidade[nome] = (row.get("responsaveis") or {}).get("capacidade_max")
        if st != "ENTREGUE" and row.get("prazo") and not row.get("entrega_original"):
            ref_date = date.fromisoformat(row["prazo"])
            if today <= ref_date <= limit:
                vence_7 += 1

    total = len(obr_rows) + len(tar_rows)
    entregue = status_counter.get("ENTREGUE", 0)
    return DashboardSummary(
        total=total,
        pendente=status_counter.get("PENDENTE", 0),
        em_andamento=status_counter.get("EM_ANDAMENTO", 0),
        em_revisao=status_counter.get("EM_REVISAO", 0),
        entregue=entregue,
        atrasado=status_counter.get("ATRASADO", 0),
        vence_em_7_dias=vence_7,
        percentual_entregue=round((entregue / total) * 100, 1) if total else 0.0,
        por_bu=dict(bu_counter),
        por_responsavel=dict(resp_counter),
        capacidade_por_responsavel=capacidade,
    )
