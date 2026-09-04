from __future__ import annotations

import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Literal
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from app.core.config import Settings, get_settings

security = HTTPBearer(auto_error=False)

UserRole = Literal["admin", "diretor", "user"]


@dataclass
class AuthUser:
    id: str
    email: str | None
    access_token: str
    role: UserRole = "user"
    must_change_password: bool = False
    is_viewer: bool = False
    view_as_responsavel_id: str | None = None

    @property
    def can_write(self) -> bool:
        return self.role != "diretor" and not self.is_viewer

    @property
    def org_wide(self) -> bool:
        """Admin e diretor veem todas as obrigações (diretor só leitura)."""
        return self.role in ("admin", "diretor")


# Short TTL — revoked/demoted roles should not linger long (Free Auth tradeoff).
_AUTH_USER_TTL_SEC = 60.0
_auth_user_cache: dict[str, tuple[float, AuthUser]] = {}
_AUTH_CACHE_MAX = 256


def _sanitize_uuid(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"null", "none", "undefined"}:
        return None
    try:
        return str(UUID(text))
    except (ValueError, TypeError):
        return None


@lru_cache(maxsize=2)
def _cached_client(url: str, key: str) -> Client:
    return create_client(url, key)


def get_anon_client(settings: Settings | None = None) -> Client:
    settings = settings or get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios")
    return _cached_client(settings.supabase_url, settings.supabase_anon_key)


def get_admin_client(settings: Settings | None = None) -> Client:
    settings = settings or get_settings()
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL é obrigatório")
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    if not key:
        raise RuntimeError("SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY é obrigatório")
    return _cached_client(settings.supabase_url, key)


def get_user_client(access_token: str, settings: Settings | None = None) -> Client:
    settings = settings or get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.postgrest.auth(access_token)
    return client


def _extract_role(user) -> UserRole:
    meta = getattr(user, "app_metadata", None) or {}
    if not isinstance(meta, dict):
        return "user"
    role = meta.get("role")
    if role == "admin":
        return "admin"
    if role == "diretor":
        return "diretor"
    return "user"


def _extract_bool_meta(meta: dict | None, key: str) -> bool:
    if not isinstance(meta, dict):
        return False
    val = meta.get(key)
    return val is True or val == "true"


def _cache_get(token: str) -> AuthUser | None:
    entry = _auth_user_cache.get(token)
    if not entry:
        return None
    expires_at, user = entry
    if time.monotonic() > expires_at:
        _auth_user_cache.pop(token, None)
        return None
    return user


def _cache_set(token: str, user: AuthUser) -> None:
    if len(_auth_user_cache) >= _AUTH_CACHE_MAX:
        doomed = sorted(_auth_user_cache.items(), key=lambda kv: kv[1][0])[
            : _AUTH_CACHE_MAX // 4
        ]
        for key, _ in doomed:
            _auth_user_cache.pop(key, None)
    _auth_user_cache[token] = (time.monotonic() + _AUTH_USER_TTL_SEC, user)


def invalidate_auth_cache(token: str | None = None) -> None:
    if token:
        _auth_user_cache.pop(token, None)
    else:
        _auth_user_cache.clear()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthUser:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação ausente",
        )
    token = credentials.credentials

    cached = _cache_get(token)
    if cached is not None:
        return cached

    client = get_anon_client(settings)
    try:
        response = client.auth.get_user(token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        ) from exc

    user = response.user
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado",
        )
    app_meta = getattr(user, "app_metadata", None) or {}
    user_meta = getattr(user, "user_metadata", None) or {}
    view_as = None
    if isinstance(app_meta, dict):
        view_as = _sanitize_uuid(app_meta.get("view_as_responsavel_id"))

    # Prefer app_metadata (server-only); fall back to legacy user_metadata once.
    must_change = _extract_bool_meta(
        app_meta if isinstance(app_meta, dict) else None,
        "must_change_password",
    ) or _extract_bool_meta(
        user_meta if isinstance(user_meta, dict) else None,
        "must_change_password",
    )

    auth_user = AuthUser(
        id=user.id,
        email=user.email,
        access_token=token,
        role=_extract_role(user),
        must_change_password=must_change,
        is_viewer=_extract_bool_meta(
            app_meta if isinstance(app_meta, dict) else None,
            "is_viewer",
        ),
        view_as_responsavel_id=view_as,
    )
    _cache_set(token, auth_user)
    return auth_user


async def require_admin(
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> AuthUser:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return user


async def require_not_viewer(
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> AuthUser:
    """Bloqueia viewer e diretor (somente leitura)."""
    if not user.can_write:
        detail = (
            "Conta somente leitura (diretor)"
            if user.role == "diretor"
            else "Conta somente leitura (visualizador)"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )
    return user


async def require_can_write(
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> AuthUser:
    return await require_not_viewer(user)


def get_db_client(
    user: Annotated[AuthUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Client:
    if settings.supabase_service_role_key and not settings.supabase_service_role_key.startswith(
        "your-"
    ):
        return get_admin_client(settings)
    return get_user_client(user.access_token, settings)
