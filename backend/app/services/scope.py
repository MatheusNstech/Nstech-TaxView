"""Escopo de dados: admin/diretor veem tudo; user/viewer só o responsável efetivo."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.core.auth import AuthUser
from app.services.notifications import get_responsavel_for_user, sanitize_uuid


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


def require_scoped_responsavel_id(user: AuthUser, client: Client) -> UUID:
    """Para não-org-wide: exige vínculo/view_as. Admin/diretor não devem chamar isto para listar tudo."""
    rid = effective_responsavel_id(user, client)
    if user.org_wide:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escopo não se aplica a admin/diretor",
        )
    if rid is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário sem responsável vinculado",
        )
    return rid


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
    scope = effective_responsavel_id(user, client)
    if scope is None or str(row.get("responsavel_id") or "") != str(scope):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Obrigação fora do seu escopo",
        )
    return row
