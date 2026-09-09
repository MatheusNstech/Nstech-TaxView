from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from supabase import Client

from app.core.auth import (
    AuthUser,
    get_current_user,
    get_db_client,
    require_admin,
    require_not_viewer,
)
from app.services.excel_export import build_obrigacoes_xlsx
from app.services.pptx_export import build_market_call_pptx, market_call_filename
from app.schemas.models import (
    AuditLogOut,
    CalendarioDia,
    CalendarioResponse,
    ComentarioCreate,
    ComentarioOut,
    GerarCompetenciaRequest,
    GerarCompetenciaResponse,
    ObrigacaoCreate,
    ObrigacaoOut,
    ObrigacaoUpdate,
    ReprovarRequest,
)
from app.services.atrasos_job import run_atrasos_job
from app.services.competencia import gerar_competencia
from app.services.notifications import (
    audit_diff,
    notify_responsavel_of_obrigacao,
    write_audit,
)
from app.services.scope import assert_obrigacao_in_scope, effective_responsavel_id
from app.services.status_engine import normalize_status, urgencia_label

router = APIRouter(prefix="/obrigacoes", tags=["obrigacoes"])


def _enrich(row: dict[str, Any]) -> dict[str, Any]:
    status_value = normalize_status(
        row.get("status") or "PENDENTE",
        date.fromisoformat(row["prazo_legal"]) if row.get("prazo_legal") else None,
        date.fromisoformat(row["prazo_fiscal"]) if row.get("prazo_fiscal") else None,
        date.fromisoformat(row["data_entrega"]) if row.get("data_entrega") else None,
    )
    row = {**row, "status": status_value}
    row["urgencia"] = urgencia_label(
        status_value,
        date.fromisoformat(row["prazo_legal"]) if row.get("prazo_legal") else None,
        date.fromisoformat(row["prazo_fiscal"]) if row.get("prazo_fiscal") else None,
    )
    if "empresas" in row:
        row["empresa"] = row.pop("empresas")
    if "atividades_modelo" in row:
        row["atividade"] = row.pop("atividades_modelo")
    if "responsaveis" in row:
        row["responsavel"] = row.pop("responsaveis")
    return row


def _scoped_responsavel_id(
    user: AuthUser,
    client: Client,
    responsavel_id: UUID | None,
) -> UUID | None:
    """Admin: filtro opcional. Diretor: sempre org-wide. Não-org-wide: escopo efetivo."""
    if user.role == "admin":
        return responsavel_id
    if user.org_wide:
        return None
    return effective_responsavel_id(user, client)


def _fetch_full(client: Client, obrigacao_id: str) -> dict[str, Any]:
    full = (
        client.table("obrigacoes")
        .select("*, empresas(*), atividades_modelo(*), responsaveis(*)")
        .eq("id", obrigacao_id)
        .single()
        .execute()
        .data
    )
    return _enrich(full)


@router.get("", response_model=list[ObrigacaoOut])
def list_obrigacoes(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    competencia: date | None = None,
    bu: str | None = None,
    responsavel_id: UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    minhas: bool = False,  # legado; escopo real vem do papel
):
    # mark_overdue / scan_prazo_7d só via POST /atualizar-atrasos (evita N writes no Free)

    resolved = _scoped_responsavel_id(user, client, responsavel_id)
    if not user.org_wide and resolved is None:
        return []

    query = client.table("obrigacoes").select(
        "*, empresas(*), atividades_modelo(*), responsaveis(*)"
    )
    if competencia:
        query = query.eq("competencia", competencia.isoformat())
    if resolved:
        query = query.eq("responsavel_id", str(resolved))
    if status_filter:
        query = query.eq("status", status_filter)
    rows = query.order("competencia", desc=True).execute().data or []
    enriched = [_enrich(r) for r in rows]
    if bu:
        enriched = [r for r in enriched if (r.get("empresa") or {}).get("bu") == bu]
    if q:
        ql = q.lower()
        enriched = [
            r
            for r in enriched
            if ql in ((r.get("empresa") or {}).get("razao_social") or "").lower()
            or ql in ((r.get("empresa") or {}).get("cnpj") or "").lower()
            or ql in ((r.get("atividade") or {}).get("nome") or "").lower()
        ]
    return enriched


@router.get("/calendario", response_model=CalendarioResponse)
def calendario(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    de: date = Query(...),
    ate: date = Query(...),
    bu: str | None = None,
    responsavel_id: UUID | None = None,
    minhas: bool = False,
    detalhe_dia: date | None = None,
):
    resolved = _scoped_responsavel_id(user, client, responsavel_id)
    if not user.org_wide and resolved is None:
        return CalendarioResponse(dias=[], detalhe=[])

    query = client.table("obrigacoes").select(
        "*, empresas(*), atividades_modelo(*), responsaveis(*)"
    )
    if resolved:
        query = query.eq("responsavel_id", str(resolved))
    rows = query.execute().data or []
    enriched = [_enrich(r) for r in rows]
    if bu:
        enriched = [r for r in enriched if (r.get("empresa") or {}).get("bu") == bu]

    by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in enriched:
        prazo = row.get("prazo_fiscal") or row.get("prazo_legal")
        if not prazo:
            continue
        d = date.fromisoformat(prazo[:10])
        if de <= d <= ate:
            by_day[d.isoformat()].append(row)

    dias: list[CalendarioDia] = []
    for key in sorted(by_day.keys()):
        items = by_day[key]
        por_status: dict[str, int] = defaultdict(int)
        atrasadas = 0
        for item in items:
            por_status[item["status"]] += 1
            if item["status"] == "ATRASADO":
                atrasadas += 1
        dias.append(
            CalendarioDia(
                data=date.fromisoformat(key),
                total=len(items),
                atrasadas=atrasadas,
                por_status=dict(por_status),
            )
        )

    detalhe: list[dict[str, Any]] = []
    if detalhe_dia:
        detalhe = by_day.get(detalhe_dia.isoformat(), [])

    from app.api.routes.tarefas import list_tarefas

    tarefas: list[Any] = []
    try:
        tarefas = list_tarefas(
            user=user,
            client=client,
            prazo_de=de,
            prazo_ate=ate,
            bu=bu,
            responsavel_id=responsavel_id,
        )
    except Exception:
        tarefas = []

    return CalendarioResponse(dias=dias, detalhe=detalhe, tarefas=tarefas)


@router.get("/export.xlsx")
def export_xlsx(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    competencia: date | None = None,
    bu: str | None = None,
    responsavel_id: UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    minhas: bool = False,
):
    rows = list_obrigacoes(
        user=user,
        client=client,
        competencia=competencia,
        bu=bu,
        responsavel_id=responsavel_id,
        status_filter=status_filter,
        q=q,
        minhas=minhas,
    )
    from app.api.routes.tarefas import list_tarefas

    tarefas = list_tarefas(
        user=user,
        client=client,
        competencia=competencia,
        bu=bu,
        responsavel_id=responsavel_id,
        status_filter=status_filter,
        q=q,
    )
    stamp = competencia.isoformat()[:7] if competencia else "todas"
    try:
        content = build_obrigacoes_xlsx(rows, competencia=competencia, tarefas=tarefas)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível gerar o Excel",
        ) from exc
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="cronograma_{stamp}.xlsx"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/export.pptx")
def export_pptx(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    competencia: date | None = None,
    bu: str | None = None,
    responsavel_id: UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
    minhas: bool = False,
):
    rows = list_obrigacoes(
        user=user,
        client=client,
        competencia=competencia,
        bu=bu,
        responsavel_id=responsavel_id,
        status_filter=status_filter,
        q=q,
        minhas=minhas,
    )
    from app.api.routes.tarefas import list_tarefas

    tarefas = list_tarefas(
        user=user,
        client=client,
        competencia=competencia,
        bu=bu,
        responsavel_id=responsavel_id,
        status_filter=status_filter,
        q=q,
    )
    filename = market_call_filename(competencia)
    try:
        content = build_market_call_pptx(rows, competencia=competencia, tarefas=tarefas)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível gerar o Market Call",
        ) from exc
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/gerar", response_model=GerarCompetenciaResponse)
def gerar(
    payload: GerarCompetenciaRequest,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    return gerar_competencia(
        client,
        competencia_destino=payload.competencia_destino,
        competencia_origem=payload.competencia_origem,
    )


@router.post("/atualizar-atrasos")
def atualizar_atrasos(
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    return run_atrasos_job(client)


@router.post("", response_model=ObrigacaoOut, status_code=status.HTTP_201_CREATED)
def create_obrigacao(
    payload: ObrigacaoCreate,
    user: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    body = payload.model_dump(mode="json")
    body["updated_by"] = user.id
    data = client.table("obrigacoes").insert(body).execute().data
    if not data:
        raise HTTPException(status_code=400, detail="Falha ao criar obrigação")
    oid = data[0]["id"]
    write_audit(
        client,
        obrigacao_id=oid,
        user_id=user.id,
        acao="CREATE",
        campo="status",
        valor_novo=body.get("status"),
    )
    if body.get("responsavel_id"):
        notify_responsavel_of_obrigacao(
            client,
            obrigacao_id=oid,
            tipo="ATRIBUICAO",
            titulo="Nova obrigação atribuída",
            corpo="Uma obrigação foi atribuída a você.",
        )
    return _fetch_full(client, oid)


@router.patch("/{obrigacao_id}", response_model=ObrigacaoOut)
def update_obrigacao(
    obrigacao_id: UUID,
    payload: ObrigacaoUpdate,
    user: Annotated[AuthUser, Depends(require_not_viewer)],
    client: Annotated[Client, Depends(get_db_client)],
):
    assert_obrigacao_in_scope(user, client, str(obrigacao_id))
    before_rows = (
        client.table("obrigacoes").select("*").eq("id", str(obrigacao_id)).limit(1).execute().data
        or []
    )
    if not before_rows:
        raise HTTPException(status_code=404, detail="Obrigação não encontrada")
    before = before_rows[0]

    body = payload.model_dump(exclude_unset=True, mode="json")
    # Não-admin não pode reatribuir responsável
    if user.role != "admin":
        body.pop("responsavel_id", None)
        body.pop("empresa_id", None)
        body.pop("atividade_id", None)
        body.pop("prazo_legal", None)
        body.pop("prazo_fiscal", None)
        body.pop("competencia", None)
    body["updated_by"] = user.id
    if body.get("data_entrega") and not body.get("status"):
        body["status"] = "ENTREGUE"

    new_status = body.get("status")
    if new_status == "ENTREGUE":
        # Atraso usa o prazo já gravado, não o prazo enviado neste PATCH.
        prazo_fiscal = before.get("prazo_fiscal")
        prazo_legal = before.get("prazo_legal")
        ref = prazo_fiscal or prazo_legal
        today = date.today()
        late = before.get("status") == "ATRASADO"
        if not late and ref:
            try:
                late = date.fromisoformat(str(ref)[:10]) < today
            except ValueError:
                late = False
        if late:
            motivo = (body.get("motivo_atraso") or before.get("motivo_atraso") or "")
            motivo = str(motivo).strip()
            if len(motivo) < 50:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Informe o motivo do atraso (mínimo 50 caracteres) "
                        "para entregar fora do prazo"
                    ),
                )
            body["motivo_atraso"] = motivo
        elif "motivo_atraso" in body and not str(body.get("motivo_atraso") or "").strip():
            body.pop("motivo_atraso", None)
        if not before.get("data_entrega") and not body.get("data_entrega"):
            body["data_entrega"] = today.isoformat()

    data = (
        client.table("obrigacoes").update(body).eq("id", str(obrigacao_id)).execute().data
    )
    if not data:
        # Select ok + update vazio = RLS/permissão (ex.: sem service_role + viewer)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para alterar esta obrigação",
        )

    after = data[0]
    audit_diff(
        client,
        obrigacao_id=str(obrigacao_id),
        user_id=user.id,
        before=before,
        after=after,
    )

    if (
        user.role == "admin"
        and body.get("responsavel_id")
        and str(body.get("responsavel_id")) != str(before.get("responsavel_id") or "")
    ):
        notify_responsavel_of_obrigacao(
            client,
            obrigacao_id=str(obrigacao_id),
            tipo="ATRIBUICAO",
            titulo="Obrigação atribuída",
            corpo="Uma obrigação foi atribuída a você.",
            exclude_user_id=user.id,
        )

    return _fetch_full(client, str(obrigacao_id))


@router.post("/{obrigacao_id}/aprovar", response_model=ObrigacaoOut)
def aprovar_obrigacao(
    obrigacao_id: UUID,
    user: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    before_rows = (
        client.table("obrigacoes").select("*").eq("id", str(obrigacao_id)).limit(1).execute().data
        or []
    )
    if not before_rows:
        raise HTTPException(status_code=404, detail="Obrigação não encontrada")
    before = before_rows[0]
    if before.get("status") != "EM_REVISAO":
        raise HTTPException(status_code=400, detail="Somente obrigações em revisão podem ser aprovadas")

    now = datetime.now(timezone.utc).isoformat()
    body: dict[str, Any] = {
        "status": "ENTREGUE",
        "aprovado_por": user.id,
        "aprovado_em": now,
        "reprovado_motivo": None,
        "updated_by": user.id,
    }
    if not before.get("data_entrega"):
        body["data_entrega"] = date.today().isoformat()

    data = (
        client.table("obrigacoes").update(body).eq("id", str(obrigacao_id)).execute().data
    )
    after = data[0]
    audit_diff(
        client,
        obrigacao_id=str(obrigacao_id),
        user_id=user.id,
        before=before,
        after=after,
        acao="APROVAR",
    )
    notify_responsavel_of_obrigacao(
        client,
        obrigacao_id=str(obrigacao_id),
        tipo="APROVACAO",
        titulo="Obrigação aprovada",
        corpo="Sua entrega foi aprovada.",
        exclude_user_id=user.id,
    )
    return _fetch_full(client, str(obrigacao_id))


@router.post("/{obrigacao_id}/reprovar", response_model=ObrigacaoOut)
def reprovar_obrigacao(
    obrigacao_id: UUID,
    payload: ReprovarRequest,
    user: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    before_rows = (
        client.table("obrigacoes").select("*").eq("id", str(obrigacao_id)).limit(1).execute().data
        or []
    )
    if not before_rows:
        raise HTTPException(status_code=404, detail="Obrigação não encontrada")
    before = before_rows[0]
    if before.get("status") != "EM_REVISAO":
        raise HTTPException(status_code=400, detail="Somente obrigações em revisão podem ser reprovadas")

    body = {
        "status": "EM_ANDAMENTO",
        "reprovado_motivo": payload.motivo,
        "aprovado_por": None,
        "aprovado_em": None,
        "updated_by": user.id,
    }
    data = (
        client.table("obrigacoes").update(body).eq("id", str(obrigacao_id)).execute().data
    )
    after = data[0]
    audit_diff(
        client,
        obrigacao_id=str(obrigacao_id),
        user_id=user.id,
        before=before,
        after=after,
        acao="REPROVAR",
    )
    client.table("obrigacao_comentarios").insert(
        {
            "obrigacao_id": str(obrigacao_id),
            "user_id": user.id,
            "autor_email": user.email,
            "texto": f"[Reprovado] {payload.motivo}",
        }
    ).execute()
    notify_responsavel_of_obrigacao(
        client,
        obrigacao_id=str(obrigacao_id),
        tipo="APROVACAO",
        titulo="Obrigação reprovada",
        corpo=payload.motivo,
        exclude_user_id=user.id,
    )
    return _fetch_full(client, str(obrigacao_id))


@router.get("/{obrigacao_id}/comentarios", response_model=list[ComentarioOut])
def list_comentarios(
    obrigacao_id: UUID,
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
):
    assert_obrigacao_in_scope(user, client, str(obrigacao_id))
    return (
        client.table("obrigacao_comentarios")
        .select("*")
        .eq("obrigacao_id", str(obrigacao_id))
        .order("created_at")
        .execute()
        .data
        or []
    )


@router.post(
    "/{obrigacao_id}/comentarios",
    response_model=ComentarioOut,
    status_code=status.HTTP_201_CREATED,
)
def create_comentario(
    obrigacao_id: UUID,
    payload: ComentarioCreate,
    user: Annotated[AuthUser, Depends(require_not_viewer)],
    client: Annotated[Client, Depends(get_db_client)],
):
    assert_obrigacao_in_scope(user, client, str(obrigacao_id))
    data = (
        client.table("obrigacao_comentarios")
        .insert(
            {
                "obrigacao_id": str(obrigacao_id),
                "user_id": user.id,
                "autor_email": user.email,
                "texto": payload.texto.strip(),
            }
        )
        .execute()
        .data
    )
    if not data:
        raise HTTPException(status_code=400, detail="Falha ao criar comentário")
    notify_responsavel_of_obrigacao(
        client,
        obrigacao_id=str(obrigacao_id),
        tipo="COMENTARIO",
        titulo="Novo comentário",
        corpo=payload.texto.strip()[:200],
        exclude_user_id=user.id,
    )
    write_audit(
        client,
        obrigacao_id=str(obrigacao_id),
        user_id=user.id,
        acao="COMENTARIO",
        campo="texto",
        valor_novo=payload.texto.strip()[:200],
    )
    return data[0]


@router.get("/{obrigacao_id}/audit", response_model=list[AuditLogOut])
def list_audit(
    obrigacao_id: UUID,
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
):
    assert_obrigacao_in_scope(user, client, str(obrigacao_id))
    return (
        client.table("obrigacao_audit_log")
        .select("*")
        .eq("obrigacao_id", str(obrigacao_id))
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
