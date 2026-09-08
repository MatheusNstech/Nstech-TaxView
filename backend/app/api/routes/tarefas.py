from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from app.core.auth import AuthUser, get_current_user, get_db_client, require_not_viewer
from app.schemas.models import TarefaCreate, TarefaOut, TarefaUpdate
from app.services.notifications import create_notification
from app.services.scope import (
    assert_obrigacao_in_scope,
    assert_tarefa_in_scope,
    effective_responsavel_id,
    resolve_responsavel,
)
from app.services.status_engine import urgencia_label

router = APIRouter(prefix="/tarefas", tags=["tarefas"])


def _enrich(row: dict[str, Any]) -> dict[str, Any]:
    status_value = row.get("status") or "PENDENTE"
    prazo = date.fromisoformat(row["prazo"]) if row.get("prazo") else None
    if status_value != "ENTREGUE" and prazo and prazo < date.today():
        status_value = "ATRASADO"
        row = {**row, "status": status_value}
    row["urgencia"] = urgencia_label(status_value, prazo, prazo)
    if "empresas" in row:
        row["empresa"] = row.pop("empresas")
    if "responsaveis" in row:
        row["responsavel"] = row.pop("responsaveis")
    return row


def _fetch_full(client: Client, tarefa_id: str) -> dict[str, Any]:
    full = (
        client.table("tarefas")
        .select("*, empresas(*), responsaveis(*)")
        .eq("id", tarefa_id)
        .single()
        .execute()
        .data
    )
    return _enrich(full)


def _time_value(value: time | str | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, time):
        return value.isoformat(timespec="minutes")
    text = str(value).strip()
    return text[:5] if text else None


def _is_late_entrega(
    *,
    current_status: str,
    prazo: date | None,
    today: date | None = None,
) -> bool:
    today = today or date.today()
    if current_status == "ATRASADO":
        return True
    return prazo is not None and prazo < today


def _scoped_responsavel_id(
    user: AuthUser,
    client: Client,
    responsavel_id: UUID | None,
) -> UUID | None:
    if user.role == "admin":
        return responsavel_id
    if user.org_wide:
        return None
    return effective_responsavel_id(user, client)


def _notify_assignee(
    client: Client,
    *,
    responsavel_id: str,
    titulo: str,
    corpo: str,
    actor_user_id: str,
) -> None:
    rows = (
        client.table("responsaveis")
        .select("auth_user_id")
        .eq("id", responsavel_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return
    target = rows[0].get("auth_user_id")
    if not target or str(target) == actor_user_id:
        return
    try:
        create_notification(
            client,
            user_id=str(target),
            tipo="ATRIBUICAO",
            titulo=titulo,
            corpo=corpo,
        )
    except Exception:
        return


@router.get("", response_model=list[TarefaOut])
def list_tarefas(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    competencia: date | None = None,
    prazo_de: date | None = None,
    prazo_ate: date | None = None,
    bu: str | None = None,
    responsavel_id: UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    categoria: str | None = None,
    q: str | None = None,
):
    resolved = _scoped_responsavel_id(user, client, responsavel_id)
    if not user.org_wide and resolved is None:
        return []

    query = client.table("tarefas").select("*, empresas(*), responsaveis(*)")
    if competencia and not (prazo_de or prazo_ate):
        query = query.eq("competencia", competencia.isoformat())
    if prazo_de:
        query = query.gte("prazo", prazo_de.isoformat())
    if prazo_ate:
        query = query.lte("prazo", prazo_ate.isoformat())
    if resolved:
        query = query.eq("responsavel_id", str(resolved))
    if status_filter:
        query = query.eq("status", status_filter)
    if categoria:
        query = query.eq("categoria", categoria)
    rows = query.order("created_at", desc=True).execute().data or []

    out: list[dict[str, Any]] = []
    needle = (q or "").strip().lower()
    for row in rows:
        enriched = _enrich(row)
        if bu:
            empresa = enriched.get("empresa") or {}
            if (empresa.get("bu") or "") != bu:
                continue
        if needle:
            hay = " ".join(
                [
                    enriched.get("titulo") or "",
                    enriched.get("descricao") or "",
                    enriched.get("solicitante_nome") or "",
                    (enriched.get("empresa") or {}).get("razao_social") or "",
                    (enriched.get("responsavel") or {}).get("nome") or "",
                ]
            ).lower()
            if needle not in hay:
                continue
        out.append(enriched)
    return out


@router.post("", response_model=TarefaOut, status_code=status.HTTP_201_CREATED)
def create_tarefa(
    body: TarefaCreate,
    user: Annotated[AuthUser, Depends(require_not_viewer)],
    client: Annotated[Client, Depends(get_db_client)],
):
    rid = body.responsavel_id
    if rid is None:
        me = resolve_responsavel(user, client)
        if not me:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe responsavel_id ou vincule seu login a um responsável",
            )
        rid = UUID(str(me["id"]))
    elif not user.org_wide:
        scope = effective_responsavel_id(user, client)
        if scope is None or str(rid) != str(scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Só é possível criar tarefas no seu escopo",
            )

    solicitante = body.solicitante_nome.strip()
    if len(solicitante) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe o nome do solicitante",
        )

    if body.obrigacao_id is not None:
        linked = assert_obrigacao_in_scope(user, client, str(body.obrigacao_id))
        if body.empresa_id is not None:
            rows = (
                client.table("obrigacoes")
                .select("empresa_id")
                .eq("id", str(body.obrigacao_id))
                .limit(1)
                .execute()
                .data
                or []
            )
            linked_empresa = (rows[0].get("empresa_id") if rows else None) or linked.get(
                "empresa_id"
            )
            if linked_empresa and str(linked_empresa) != str(body.empresa_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Empresa não corresponde à obrigação informada",
                )
    elif body.empresa_id is not None:
        empresa = (
            client.table("empresas")
            .select("id")
            .eq("id", str(body.empresa_id))
            .limit(1)
            .execute()
            .data
            or []
        )
        if not empresa:
            raise HTTPException(status_code=404, detail="Empresa não encontrada")

    motivo_atraso = None
    if body.status.value == "ENTREGUE" and body.prazo < date.today():
        motivo = (body.motivo_atraso or "").strip()
        if len(motivo) < 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Informe o motivo do atraso (mínimo 50 caracteres) "
                    "para criar a tarefa já entregue fora do prazo"
                ),
            )
        motivo_atraso = motivo

    payload = {
        "titulo": body.titulo.strip(),
        "solicitante_nome": solicitante,
        "descricao": body.descricao,
        "categoria": body.categoria.value,
        "status": body.status.value,
        "competencia": body.competencia.isoformat() if body.competencia else None,
        "prazo": body.prazo.isoformat() if body.prazo else None,
        "hora_inicio": _time_value(body.hora_inicio),
        "hora_fim": _time_value(body.hora_fim),
        "empresa_id": str(body.empresa_id) if body.empresa_id else None,
        "obrigacao_id": str(body.obrigacao_id) if body.obrigacao_id else None,
        "responsavel_id": str(rid),
        "created_by": user.id,
        "motivo_atraso": motivo_atraso,
        "entregue_em": (
            datetime.now(timezone.utc).isoformat()
            if body.status.value == "ENTREGUE"
            else None
        ),
    }
    created = client.table("tarefas").insert(payload).execute().data
    if not created:
        raise HTTPException(status_code=400, detail="Falha ao criar tarefa")
    tarefa_id = str(created[0]["id"])
    _notify_assignee(
        client,
        responsavel_id=str(rid),
        titulo=f"Nova tarefa: {payload['titulo']}",
        corpo="Uma tarefa foi atribuída a você.",
        actor_user_id=user.id,
    )
    return _fetch_full(client, tarefa_id)


@router.patch("/{tarefa_id}", response_model=TarefaOut)
def update_tarefa(
    tarefa_id: UUID,
    body: TarefaUpdate,
    user: Annotated[AuthUser, Depends(require_not_viewer)],
    client: Annotated[Client, Depends(get_db_client)],
):
    current = assert_tarefa_in_scope(user, client, str(tarefa_id))
    patch = body.model_dump(exclude_unset=True)
    if "categoria" in patch and patch["categoria"] is not None:
        patch["categoria"] = patch["categoria"].value
    if "status" in patch and patch["status"] is not None:
        patch["status"] = patch["status"].value
    for key in ("competencia", "prazo"):
        if key in patch and patch[key] is not None:
            patch[key] = patch[key].isoformat()
    for key in ("hora_inicio", "hora_fim"):
        if key in patch:
            patch[key] = _time_value(patch[key])

    horas_no_patch = "hora_inicio" in patch or "hora_fim" in patch
    if horas_no_patch:
        inicio = patch.get("hora_inicio", current.get("hora_inicio"))
        fim = patch.get("hora_fim", current.get("hora_fim"))
        if not inicio or not fim:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe início e fim do horário",
            )
        prazo_raw = patch.get("prazo", current.get("prazo"))
        if not prazo_raw:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe o prazo do dia para definir o horário",
            )
    elif "prazo" in patch and patch["prazo"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe o prazo do dia para definir o horário",
        )
    for key in ("empresa_id", "obrigacao_id", "responsavel_id"):
        if key in patch and patch[key] is not None:
            patch[key] = str(patch[key])
    if "solicitante_nome" in patch and patch["solicitante_nome"] is not None:
        patch["solicitante_nome"] = str(patch["solicitante_nome"]).strip()

    if user.role != "admin":
        patch.pop("prazo", None)
        patch.pop("competencia", None)

    if patch.get("obrigacao_id"):
        assert_obrigacao_in_scope(user, client, str(patch["obrigacao_id"]))

    if "responsavel_id" in patch and not user.org_wide:
        scope = effective_responsavel_id(user, client)
        if scope is None or str(patch["responsavel_id"]) != str(scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Não é possível reatribuir fora do seu escopo",
            )

    new_status = patch.get("status")
    if new_status == "ENTREGUE":
        prazo_raw = current.get("prazo")
        prazo = date.fromisoformat(str(prazo_raw)[:10]) if prazo_raw else None
        late = _is_late_entrega(
            current_status=str(current.get("status") or "PENDENTE"),
            prazo=prazo,
        )
        if late:
            motivo = patch.get("motivo_atraso") or current.get("motivo_atraso") or ""
            motivo = str(motivo).strip()
            if len(motivo) < 50:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Informe o motivo do atraso (mínimo 50 caracteres) "
                        "para entregar fora do prazo"
                    ),
                )
            patch["motivo_atraso"] = motivo
        elif "motivo_atraso" in patch:
            patch.pop("motivo_atraso", None)
        if not current.get("entregue_em"):
            patch["entregue_em"] = datetime.now(timezone.utc).isoformat()

    if not patch:
        return _fetch_full(client, str(tarefa_id))

    client.table("tarefas").update(patch).eq("id", str(tarefa_id)).execute()
    if "responsavel_id" in patch:
        _notify_assignee(
            client,
            responsavel_id=str(patch["responsavel_id"]),
            titulo="Tarefa reatribuída",
            corpo="Uma tarefa foi atribuída a você.",
            actor_user_id=user.id,
        )
    return _fetch_full(client, str(tarefa_id))


@router.delete("/{tarefa_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tarefa(
    tarefa_id: UUID,
    user: Annotated[AuthUser, Depends(require_not_viewer)],
    client: Annotated[Client, Depends(get_db_client)],
):
    row = assert_tarefa_in_scope(user, client, str(tarefa_id))
    if user.role != "admin" and str(row.get("created_by") or "") != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Só o criador ou admin pode excluir a tarefa",
        )
    client.table("tarefas").delete().eq("id", str(tarefa_id)).execute()
    return None
