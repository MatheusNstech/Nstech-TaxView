from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client

from app.core.auth import (
    AuthUser,
    get_admin_client,
    get_current_user,
    get_db_client,
    invalidate_auth_cache,
)
from app.core.config import Settings, get_settings
from app.schemas.models import MeOut, UsuarioRole
from app.services.scope import resolve_responsavel

router = APIRouter(tags=["me"])


class ClearMustChangeOut(BaseModel):
    ok: bool = True


class ChangePasswordBody(BaseModel):
    """Used only for validation length when clearing flag after client password update."""

    password: str = Field(min_length=12)


@router.get("/me", response_model=MeOut)
def get_me(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
):
    resp = resolve_responsavel(user, client)
    return MeOut(
        user_id=user.id,
        email=user.email,
        role=UsuarioRole(user.role),
        responsavel_id=resp["id"] if resp else None,
        responsavel_nome=resp["nome"] if resp else None,
        must_change_password=user.must_change_password,
        is_viewer=user.is_viewer,
    )


@router.post("/me/clear-must-change-password", response_model=ClearMustChangeOut)
def clear_must_change_password(
    user: Annotated[AuthUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    """Clear must_change_password in app_metadata (server-only). Call after password update."""
    key = settings.supabase_service_role_key
    if not key or key.startswith("your-"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_SERVICE_ROLE_KEY necessária para limpar must_change_password",
        )
    admin = get_admin_client(settings)
    try:
        admin.auth.admin.update_user_by_id(
            user.id,
            {
                "app_metadata": {"must_change_password": False},
                "user_metadata": {"must_change_password": False},
            },
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=400,
            detail=f"Falha ao atualizar metadata: {exc}",
        ) from exc
    invalidate_auth_cache(user.access_token)
    return ClearMustChangeOut()
