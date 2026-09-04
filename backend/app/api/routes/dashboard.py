from collections import Counter
from datetime import date, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from supabase import Client

from app.core.auth import AuthUser, get_current_user, get_db_client
from app.schemas.models import DashboardSummary
from app.services.scope import effective_responsavel_id
from app.services.status_engine import normalize_status

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    competencia: date | None = None,
    bu: str | None = None,
    responsavel_id: UUID | None = None,
):
    query = client.table("obrigacoes").select(
        "id,status,prazo_legal,prazo_fiscal,data_entrega,responsavel_id,"
        "empresas(bu,razao_social),responsaveis(nome,capacidade_max)"
    )
    if competencia:
        query = query.eq("competencia", competencia.isoformat())

    if user.org_wide:
        if user.role == "admin" and responsavel_id:
            query = query.eq("responsavel_id", str(responsavel_id))
    else:
        scope = effective_responsavel_id(user, client)
        if scope is None:
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
        query = query.eq("responsavel_id", str(scope))

    rows = query.execute().data or []
    if bu:
        rows = [r for r in rows if (r.get("empresas") or {}).get("bu") == bu]

    today = date.today()
    limit = today + timedelta(days=7)
    status_counter: Counter[str] = Counter()
    bu_counter: Counter[str] = Counter()
    resp_counter: Counter[str] = Counter()
    capacidade: dict[str, int | None] = {}
    vence_7 = 0

    for row in rows:
        st = normalize_status(
            row.get("status") or "PENDENTE",
            date.fromisoformat(row["prazo_legal"]) if row.get("prazo_legal") else None,
            date.fromisoformat(row["prazo_fiscal"]) if row.get("prazo_fiscal") else None,
            date.fromisoformat(row["data_entrega"]) if row.get("data_entrega") else None,
            today=today,
        )
        status_counter[st] += 1
        bu_counter[(row.get("empresas") or {}).get("bu") or "N/A"] += 1
        nome = (row.get("responsaveis") or {}).get("nome") or "Sem responsável"
        resp_counter[nome] += 1
        if nome not in capacidade:
            capacidade[nome] = (row.get("responsaveis") or {}).get("capacidade_max")
        ref = row.get("prazo_fiscal") or row.get("prazo_legal")
        if st != "ENTREGUE" and ref:
            ref_date = date.fromisoformat(ref)
            if today <= ref_date <= limit:
                vence_7 += 1

    total = len(rows)
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
