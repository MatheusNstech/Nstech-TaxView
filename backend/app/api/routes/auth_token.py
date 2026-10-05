"""Autenticação para clientes externos (app desktop)."""
from __future__ import annotations

from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.core.config import Settings, get_settings

router = APIRouter(prefix="/auth", tags=["auth"])

_GOTRUE_TIMEOUT = httpx.Timeout(15.0)


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


def _gotrue_headers(settings: Settings, access_token: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": settings.supabase_anon_key,
        "Content-Type": "application/json",
    }
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    return headers


def _password_grant(settings: Settings, email: str, password: str) -> dict[str, Any] | None:
    # Chamada sem estado: o cliente supabase compartilhado guardaria a sessão
    # (e o refresh automático) do último usuário logado.
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"
    try:
        resp = httpx.post(
            url,
            json={"email": email, "password": password},
            headers=_gotrue_headers(settings),
            timeout=_GOTRUE_TIMEOUT,
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth indisponível",
        ) from None
    if resp.status_code != 200:
        return None
    try:
        return resp.json()
    except ValueError:
        return None


def _revoke_session(settings: Settings, access_token: str) -> None:
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/logout?scope=local"
    try:
        httpx.post(
            url,
            headers=_gotrue_headers(settings, access_token),
            timeout=_GOTRUE_TIMEOUT,
        )
    except httpx.HTTPError:
        pass


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

    data = _password_grant(settings, body.email.strip(), body.password)
    access_token = (data or {}).get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos",
        )

    user = data.get("user") or {}
    meta = user.get("app_metadata") or {}
    role = meta.get("role") if isinstance(meta, dict) else None
    if role not in ("admin", "diretor"):
        # Desktop de faturamento: só contas admin/diretor
        _revoke_session(settings, access_token)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta sem permissão para integração de valores",
        )

    expires_in = data.get("expires_in")
    return TokenResponse(
        access_token=access_token,
        refresh_token=data.get("refresh_token"),
        expires_in=int(expires_in) if expires_in is not None else None,
        user_id=str(user["id"]) if user.get("id") else None,
        email=user.get("email"),
        role=str(role),
    )
