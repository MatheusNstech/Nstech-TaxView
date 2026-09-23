"""Autenticação para clientes externos (app desktop)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.core.auth import get_anon_client
from app.core.config import Settings, get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int | None = None
    refresh_token: str | None = None
    user_id: str | None = None
    email: str | None = None
    role: str | None = None


@router.post("/token", response_model=TokenResponse)
def login_token(
    body: TokenRequest,
    settings: Annotated[Settings, Depends(get_settings)],
):
    """Login e-mail/senha → JWT (Supabase). Uso típico do app desktop."""
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth indisponível",
        )

    client = get_anon_client(settings)
    try:
        result = client.auth.sign_in_with_password(
            {"email": body.email.strip(), "password": body.password}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos",
        ) from None

    session = getattr(result, "session", None)
    user = getattr(result, "user", None)
    if session is None or not getattr(session, "access_token", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos",
        )

    meta = getattr(user, "app_metadata", None) or {}
    role = meta.get("role") if isinstance(meta, dict) else None
    if role not in ("admin", "diretor"):
        # Desktop de faturamento: só contas admin/diretor
        try:
            client.auth.sign_out()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta sem permissão para integração de valores",
        )

    expires_in = getattr(session, "expires_in", None)
    return TokenResponse(
        access_token=session.access_token,
        refresh_token=getattr(session, "refresh_token", None),
        expires_in=int(expires_in) if expires_in is not None else None,
        user_id=str(user.id) if user and getattr(user, "id", None) else None,
        email=getattr(user, "email", None),
        role=str(role),
    )
