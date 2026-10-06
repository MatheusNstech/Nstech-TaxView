"""Escopo de dados: admin/diretor veem tudo; user/viewer o responsável efetivo e,
se ele for da equipe compartilhada, os colegas da equipe."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.core.auth import AuthUser
from app.services.notifications import get_responsavel_for_user, sanitize_uuid
from app.services.obrigacao_responsaveis import responsavel_ids_of


def resolve_responsavel(user: AuthUser, client: Client) -> dict[str, Any] | None:
    view_as = sanitize_uuid(user.view_as_responsavel_id)
    return get_responsavel_for_user(
        client,
        user.id,
        view_as_responsavel_id=view_as,
    )


def effective_responsavel_id(user: AuthUser, client: Client) -> UUID | None:
    """None = sem filtro (admin/diretor). Caso contrário UUID do responsável do escopo."""
    if user.org_wide:
        return None
    resp = resolve_responsavel(user, client)
    if not resp:
        return None
    return UUID(str(resp["id"]))


def team_responsavel_ids(user: AuthUser, client: Client) -> set[str]:
    """Responsáveis que o usuário pode ver/operar: o próprio e, se ele for da equipe
    compartilhada, todos os membros ativos dela. Vazio = sem responsável."""
    own = effective_responsavel_id(user, client)
    if own is None:
        return set()
    own_id = str(own)
    flag = (
        client.table("responsaveis")
        .select("id,equipe_compartilhada")
        .eq("id", own_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not flag or not flag[0].get("equipe_compartilhada"):
        return {own_id}
    rows = (
        client.table("responsaveis")
        .select("id")
        .eq("equipe_compartilhada", True)
        .eq("ativo", True)
        .execute()
        .data
        or []
    )
    return {own_id} | {str(r["id"]) for r in rows}


def list_scope_ids(
    user: AuthUser,
    client: Client,
    responsavel_id: UUID | None,
    *,
    equipe: bool = False,
) -> list[str] | None:
    """Responsáveis a listar. None = sem filtro (admin sem filtro / diretor).

    Fora de admin/diretor, o padrão continua sendo só o próprio; a equipe só entra
    quando a tela pede (`responsavel_id` de um colega ou `equipe=True`).
    """
    if user.role == "admin":
        return [str(responsavel_id)] if responsavel_id else None
    if user.org_wide:
        return None
    own = effective_responsavel_id(user, client)
    if own is None:
        return []
    if not responsavel_id and not equipe:
        return [str(own)]
    team = team_responsavel_ids(user, client)
    if responsavel_id:
        return [str(responsavel_id)] if str(responsavel_id) in team else [str(own)]
    return sorted(team)


def assert_obrigacao_in_scope(
    user: AuthUser,
    client: Client,
    obrigacao_id: str,
) -> dict[str, Any]:
    rows = (
        client.table("obrigacoes")
        .select("id,responsavel_id")
        .eq("id", obrigacao_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Obrigação não encontrada")
    row = rows[0]
    if user.org_wide:
        return row
    team = team_responsavel_ids(user, client)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Obrigação fora do seu escopo",
        )
    if str(row.get("responsavel_id") or "") in team:
        return row
    if not team & responsavel_ids_of(client, obrigacao_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Obrigação fora do seu escopo",
        )
    return row


def assert_tarefa_in_scope(
    user: AuthUser,
    client: Client,
    tarefa_id: str,
) -> dict[str, Any]:
    rows = (
        client.table("tarefas")
        .select(
            "id,responsavel_id,created_by,status,prazo,hora_inicio,hora_fim,"
            "motivo_atraso,entregue_em,entrega_original"
        )
        .eq("id", tarefa_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    row = rows[0]
    if user.org_wide:
        return row
    if str(row.get("responsavel_id") or "") not in team_responsavel_ids(user, client):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tarefa fora do seu escopo",
        )
    return row
