import logging
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

logger = logging.getLogger(__name__)

router = APIRouter(tags=["me"])

# Senha inicial conhecida — recusada só no servidor, fora do bundle do front.
_BLOCKED_PASSWORDS = {"senha@123"}


class ChangePasswordBody(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class ChangePasswordOut(BaseModel):
    ok: bool = True


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


@router.post("/me/change-password", response_model=ChangePasswordOut)
def change_password(
    body: ChangePasswordBody,
    user: Annotated[AuthUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    """Atualiza a senha e só então limpa must_change_password."""
    password = body.password.strip()
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve ter ao menos 8 caracteres",
        )
    if password.lower() in _BLOCKED_PASSWORDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escolha uma senha diferente da padrão",
        )

    key = settings.supabase_service_role_key
    if not key or key.startswith("your-"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço de autenticação indisponível",
        )

    admin = get_admin_client(settings)
    try:
        current = admin.auth.admin.get_user_by_id(user.id)
        existing = current.user
        if existing is None:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        app_meta = dict(getattr(existing, "app_metadata", None) or {})
        user_meta = dict(getattr(existing, "user_metadata", None) or {})
        app_meta["must_change_password"] = False
        user_meta["must_change_password"] = False
        admin.auth.admin.update_user_by_id(
            user.id,
            {
                "password": password,
                "app_metadata": app_meta,
                "user_metadata": user_meta,
            },
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Falha ao trocar senha user_id=%s", user.id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Falha ao trocar senha",
        ) from None

    invalidate_auth_cache(user.access_token)
    return ChangePasswordOut()
