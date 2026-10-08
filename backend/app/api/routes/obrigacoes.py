from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from supabase import Client

from app.api.routes.tarefas import query_tarefas
from app.core.auth import (
    AuthUser,
    get_current_user,
    get_db_client,
    require_admin,
    require_not_viewer,
)
from app.core.clock import today_br
from app.services.db import constraint_errors, fetch_all, reject_nulls
from app.services.excel_export import build_obrigacoes_xlsx
from app.services.pptx_export import build_market_call_pptx, market_call_filename
from app.schemas.models import (
    AuditLogOut,
    CalendarioResponse,
    ComentarioCreate,
    ComentarioOut,
    CopiarRequest,
    CopiarResponse,
    GerarCompetenciaRequest,
    GerarCompetenciaResponse,
    ObrigacaoCreate,
    ObrigacaoOut,
    ObrigacaoUpdate,
    ReprovarRequest,
    StatusObrigacao,
)
from app.services.calendario import resumo_dia
from app.services.copia import carregar_destinos
from app.services.competencia import gerar_competencia
from app.services.equipe import registrar_acao_equipe_obrigacao
from app.services.notifications import (
    AUDIT_FIELDS,
    audit_diff,
    notify_responsavel_of_obrigacao,
    write_audit,
)
from app.services.obrigacao_responsaveis import (
    RESPONSAVEIS_EMBED,
    apply_responsavel_filter,
    pop_responsaveis,
    select_with_responsavel_filter,
    set_responsaveis,
)
from app.services.scope import (
    assert_obrigacao_in_scope,
    effective_responsavel_id,
    list_scope_ids,
)
from app.services.status_engine import (
    as_br_date,
    is_delivered,
    normalize_status,
    status_filter_values,
    urgencia_label,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/obrigacoes", tags=["obrigacoes"])

_FULL_SELECT = f"*, empresas(*), atividades_modelo(*), responsaveis(*), {RESPONSAVEIS_EMBED}"


def _enrich(row: dict[str, Any]) -> dict[str, Any]:
    entrega_original = as_br_date(row.get("entrega_original"))
    status_value = normalize_status(
        row.get("status") or "PENDENTE",
        date.fromisoformat(row["prazo_legal"]) if row.get("prazo_legal") else None,
        date.fromisoformat(row["prazo_fiscal"]) if row.get("prazo_fiscal") else None,
        date.fromisoformat(row["data_entrega"]) if row.get("data_entrega") else None,
        entrega_original=entrega_original,
    )
    row = {**row, "status": status_value}
    row["urgencia"] = urgencia_label(
        status_value,
        date.fromisoformat(row["prazo_legal"]) if row.get("prazo_legal") else None,
        date.fromisoformat(row["prazo_fiscal"]) if row.get("prazo_fiscal") else None,
        entrega_original=entrega_original,
    )
    if "empresas" in row:
        row["empresa"] = row.pop("empresas")
    if "atividades_modelo" in row:
        row["atividade"] = row.pop("atividades_modelo")
    if "responsaveis" in row:
        row["responsavel"] = row.pop("responsaveis")
    row["responsaveis"] = pop_responsaveis(row, row.get("responsavel"))
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
    rows = (
        client.table("obrigacoes")
        .select(_FULL_SELECT)
        .eq("id", obrigacao_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Obrigação não encontrada")
    return _enrich(rows[0])


def query_obrigacoes(
    user: AuthUser,
    client: Client,
    *,
    competencia: date | None = None,
    bu: str | None = None,
    responsavel_id: UUID | None = None,
    status_filter: StatusObrigacao | None = None,
    q: str | None = None,
    atividade_id: UUID | None = None,
    equipe: bool = False,
) -> list[dict[str, Any]]:
    # Atraso e aviso saem do job diário run_atrasos_diarios, não desta listagem.
    rid = list_scope_ids(user, client, responsavel_id, equipe=equipe)
    if rid is not None and not rid:
        return []

    def build():
        query = client.table("obrigacoes").select(
            select_with_responsavel_filter(_FULL_SELECT, rid)
        )
        if competencia:
            query = query.eq("competencia", competencia.isoformat())
        query = apply_responsavel_filter(query, rid)
        # Atraso também é calculado pelo prazo, então "Atrasado" filtra depois do _enrich.
        if status_filter and status_filter.value != "ATRASADO":
            query = query.in_("status", status_filter_values(status_filter.value))
        if atividade_id:
            query = query.eq("atividade_id", str(atividade_id))
        return query.order("competencia", desc=True).order("id")

    enriched = [_enrich(r) for r in fetch_all(build)]
    if status_filter and status_filter.value == "ATRASADO":
        enriched = [
            r for r in enriched if r["status"] == "ATRASADO" or r.get("urgencia") == "atrasado"
        ]
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


@router.get("", response_model=list[ObrigacaoOut])
def list_obrigacoes(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    competencia: date | None = None,
    bu: str | None = None,
    responsavel_id: UUID | None = None,
    status_filter: StatusObrigacao | None = Query(default=None, alias="status"),
    q: str | None = None,
    atividade_id: UUID | None = None,
    equipe: bool = False,
    minhas: bool = False,  # legado; escopo real vem do papel
):
    return query_obrigacoes(
        user,
        client,
        competencia=competencia,
        bu=bu,
        responsavel_id=responsavel_id,
        status_filter=status_filter,
        q=q,
        atividade_id=atividade_id,
        equipe=equipe,
    )


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
    sem_escopo = not user.org_wide and resolved is None

    de_iso, ate_iso = de.isoformat(), ate.isoformat()
    # Mesmo critério do agrupamento abaixo: prazo_fiscal, ou prazo_legal quando não há fiscal.
    em_intervalo = (
        f"and(prazo_fiscal.gte.{de_iso},prazo_fiscal.lte.{ate_iso}),"
        f"and(prazo_fiscal.is.null,prazo_legal.gte.{de_iso},prazo_legal.lte.{ate_iso})"
    )

    rid = str(resolved) if resolved else None

    def build():
        query = (
            client.table("obrigacoes")
            .select(select_with_responsavel_filter(_FULL_SELECT, rid))
            .or_(em_intervalo)
        )
        return apply_responsavel_filter(query, rid).order("id")

    enriched = [] if sem_escopo else [_enrich(r) for r in fetch_all(build)]
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

    tarefas: list[dict[str, Any]] = []
    try:
        tarefas = query_tarefas(
            user,
            client,
            prazo_de=de,
            prazo_ate=ate,
            bu=bu,
            responsavel_id=responsavel_id,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Falha ao carregar tarefas do calendário")

    tarefas_by_day: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for t in tarefas:
        if t.get("prazo"):
            tarefas_by_day[str(t["prazo"])[:10]].append(t)

    dias = [
        resumo_dia(date.fromisoformat(key), by_day.get(key, []), tarefas_by_day.get(key, []))
        for key in sorted(by_day.keys() | tarefas_by_day.keys())
    ]

    detalhe: list[dict[str, Any]] = []
    if detalhe_dia:
        detalhe = by_day.get(detalhe_dia.isoformat(), [])

    return CalendarioResponse(dias=dias, detalhe=detalhe, tarefas=tarefas)


def _export_rows(
    user: AuthUser,
    client: Client,
    atividade_id: UUID | None = None,
    **filters: Any,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rows = query_obrigacoes(user, client, atividade_id=atividade_id, **filters)
    # Tarefas avulsas não têm tipo de serviço: somem quando o filtro está ativo.
    tarefas = [] if atividade_id else query_tarefas(user, client, **filters)
    return rows, tarefas


@router.get("/export.xlsx")
def export_xlsx(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    competencia: date | None = None,
    bu: str | None = None,
    responsavel_id: UUID | None = None,
    status_filter: StatusObrigacao | None = Query(default=None, alias="status"),
    q: str | None = None,
    atividade_id: UUID | None = None,
    minhas: bool = False,
):
    rows, tarefas = _export_rows(
        user,
        client,
        atividade_id=atividade_id,
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
    status_filter: StatusObrigacao | None = Query(default=None, alias="status"),
    q: str | None = None,
    atividade_id: UUID | None = None,
    minhas: bool = False,
):
    rows, tarefas = _export_rows(
        user,
        client,
        atividade_id=atividade_id,
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


@router.post("", response_model=ObrigacaoOut, status_code=status.HTTP_201_CREATED)
def create_obrigacao(
    payload: ObrigacaoCreate,
    user: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    body = payload.model_dump(mode="json")
    co_ids = [str(r) for r in (body.pop("responsavel_ids", None) or [])]
    if not body.get("responsavel_id") and co_ids:
        body["responsavel_id"] = co_ids[0]
    body["updated_by"] = user.id
    with constraint_errors(
        duplicate="Já existe essa obrigação para a empresa nesta competência",
        in_use="Empresa, atividade ou responsável inexistente",
    ):
        data = client.table("obrigacoes").insert(body).execute().data
        if data and co_ids:
            set_responsaveis(client, data[0]["id"], co_ids, body.get("responsavel_id"))
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


@router.post("/{obrigacao_id}/copiar", response_model=CopiarResponse)
def copiar_obrigacao(
    obrigacao_id: UUID,
    body: CopiarRequest,
    user: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    origem = _fetch_full(client, str(obrigacao_id))
    destinos, ignoradas = carregar_destinos(
        client, [str(e) for e in body.empresa_ids], str(origem["empresa_id"])
    )
    duplicada = "Já existe essa obrigação para a empresa nesta competência"
    existentes: set[str] = set()
    if destinos:
        rows = (
            client.table("obrigacoes")
            .select("empresa_id")
            .eq("atividade_id", str(origem["atividade_id"]))
            .eq("competencia", str(origem["competencia"]))
            .in_("empresa_id", list(destinos))
            .execute()
            .data
            or []
        )
        existentes = {str(r["empresa_id"]) for r in rows}

    principal = str(origem["responsavel_id"]) if origem.get("responsavel_id") else None
    co_ids = [str(r["id"]) for r in origem.get("responsaveis") or [] if r.get("id")]
    criadas = 0
    for eid in destinos:
        if eid in existentes:
            ignoradas.append({"empresa_id": eid, "motivo": duplicada})
            continue
        payload = {
            "empresa_id": eid,
            "atividade_id": str(origem["atividade_id"]),
            "competencia": origem["competencia"],
            "prazo_legal": origem.get("prazo_legal"),
            "prazo_fiscal": origem.get("prazo_fiscal"),
            "categoria": origem.get("categoria") or "fechamento",
            "responsavel_id": principal,
            "status": "PENDENTE",
            "updated_by": user.id,
        }
        try:
            with constraint_errors(duplicate=duplicada):
                data = client.table("obrigacoes").insert(payload).execute().data
        except HTTPException as exc:
            ignoradas.append({"empresa_id": eid, "motivo": str(exc.detail)})
            continue
        if not data:
            ignoradas.append({"empresa_id": eid, "motivo": "Falha ao criar obrigação"})
            continue
        oid = str(data[0]["id"])
        if co_ids:
            set_responsaveis(client, oid, co_ids, principal)
        write_audit(
            client,
            obrigacao_id=oid,
            user_id=user.id,
            acao="CREATE",
            campo="copiada_de",
            valor_novo=str(obrigacao_id),
        )
        criadas += 1
        if principal:
            notify_responsavel_of_obrigacao(
                client,
                obrigacao_id=oid,
                tipo="ATRIBUICAO",
                titulo="Nova obrigação atribuída",
                corpo="Uma obrigação foi copiada para outra empresa e atribuída a você.",
            )
    return CopiarResponse(criadas=criadas, ignoradas=ignoradas)


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
    reject_nulls(body, ("empresa_id", "atividade_id", "competencia", "status"))
    new_responsavel_ids: list[str] | None = None
    if "responsavel_ids" in body:
        raw_ids = body.pop("responsavel_ids")
        new_responsavel_ids = [str(r) for r in (raw_ids or [])]
    # Não-admin não pode reatribuir responsável
    if user.role != "admin":
        new_responsavel_ids = None
        body.pop("responsavel_id", None)
        body.pop("empresa_id", None)
        body.pop("atividade_id", None)
        body.pop("prazo_legal", None)
        body.pop("prazo_fiscal", None)
        body.pop("competencia", None)
    if new_responsavel_ids is not None:
        principal = body.get("responsavel_id", before.get("responsavel_id"))
        if principal and str(principal) not in new_responsavel_ids and "responsavel_id" not in body:
            # Lista sem o principal atual: o primeiro da lista assume como principal.
            principal = new_responsavel_ids[0] if new_responsavel_ids else None
            body["responsavel_id"] = principal
        elif not principal and new_responsavel_ids:
            body["responsavel_id"] = new_responsavel_ids[0]
    body["updated_by"] = user.id
    if body.get("data_entrega") and not body.get("status"):
        body["status"] = "ENTREGUE"

    new_status = body.get("status")
    entrega_original = as_br_date(before.get("entrega_original"))
    if new_status and not is_delivered(new_status):
        # normalize_status trata data_entrega preenchida como ENTREGUE; sem limpar,
        # a obrigação nunca sai da coluna Entregue.
        body["data_entrega"] = None
        if before.get("data_entrega") or is_delivered(before.get("status")):
            # Reabertura: a data guardada evita que o item volte como atrasado.
            original = entrega_original or as_br_date(before.get("data_entrega")) or today_br()
            body["entrega_original"] = original.isoformat()
    if is_delivered(new_status):
        # Atraso usa o prazo já gravado, não o prazo enviado neste PATCH.
        prazo_fiscal = before.get("prazo_fiscal")
        prazo_legal = before.get("prazo_legal")
        ref = prazo_fiscal or prazo_legal
        today = today_br()
        if entrega_original:
            body["data_entrega"] = entrega_original.isoformat()
            body["entrega_original"] = None
        # Já entregue (parcial -> entregue) ou reaberta: vale a data da entrega.
        ja_entregue = entrega_original or as_br_date(before.get("data_entrega"))
        dia_entrega = ja_entregue or today
        late = before.get("status") == "ATRASADO" and not ja_entregue
        if not late and ref:
            try:
                late = date.fromisoformat(str(ref)[:10]) < dia_entrega
            except ValueError:
                late = False
        if late:
            motivo = (body.get("motivo_atraso") or before.get("motivo_atraso") or "")
            motivo = str(motivo).strip()
            if len(motivo) < 20:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Informe o motivo do atraso (mínimo 20 caracteres) "
                        "para entregar fora do prazo"
                    ),
                )
            body["motivo_atraso"] = motivo
        elif "motivo_atraso" in body and not str(body.get("motivo_atraso") or "").strip():
            body.pop("motivo_atraso", None)
        if not before.get("data_entrega") and not body.get("data_entrega"):
            body["data_entrega"] = today.isoformat()

    with constraint_errors(
        duplicate="Já existe essa obrigação para a empresa nesta competência",
        in_use="Empresa, atividade ou responsável inexistente",
    ):
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

    added: set[str] = set()
    if (
        user.role == "admin"
        and after.get("responsavel_id")
        and str(after.get("responsavel_id")) != str(before.get("responsavel_id") or "")
    ):
        added.add(str(after["responsavel_id"]))
    if new_responsavel_ids is not None:
        novos, removidos = set_responsaveis(
            client,
            str(obrigacao_id),
            new_responsavel_ids,
            after.get("responsavel_id"),
        )
        added |= novos
        if novos or removidos:
            write_audit(
                client,
                obrigacao_id=str(obrigacao_id),
                user_id=user.id,
                acao="UPDATE",
                campo="responsaveis",
                valor_novo=",".join(sorted(new_responsavel_ids)),
            )
    if added:
        notify_responsavel_of_obrigacao(
            client,
            obrigacao_id=str(obrigacao_id),
            tipo="ATRIBUICAO",
            titulo="Obrigação atribuída",
            corpo="Uma obrigação foi atribuída a você.",
            exclude_user_id=user.id,
            only_responsavel_ids=added,
        )

    full = _fetch_full(client, str(obrigacao_id))
    if any(str(before.get(c) or "") != str(after.get(c) or "") for c in AUDIT_FIELDS):
        registrar_acao_equipe_obrigacao(
            client, user, full, status_antes=before.get("status")
        )
    return full


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
        original = as_br_date(before.get("entrega_original"))
        body["data_entrega"] = (original or today_br()).isoformat()
        body["entrega_original"] = None

    data = (
        client.table("obrigacoes").update(body).eq("id", str(obrigacao_id)).execute().data
    )
    if not data:
        raise HTTPException(status_code=404, detail="Obrigação não encontrada")
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
    if not data:
        raise HTTPException(status_code=404, detail="Obrigação não encontrada")
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
