from __future__ import annotations

from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.core.auth import (
    AuthUser,
    get_admin_client,
    get_current_user,
    get_db_client,
    get_user_client,
    require_admin,
)
from app.core.config import Settings, get_settings
from app.schemas.models import UsuarioCreate, UsuarioOut, UsuarioRole, UsuarioUpdate

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


def _has_service_role(settings: Settings) -> bool:
    key = settings.supabase_service_role_key
    return bool(key and not key.startswith("your-"))


def _role_from_user(user) -> Literal["admin", "diretor", "user"]:
    meta = getattr(user, "app_metadata", None) or {}
    if not isinstance(meta, dict):
        return "user"
    role = meta.get("role")
    if role == "admin":
        return "admin"
    if role == "diretor":
        return "diretor"
    return "user"


def _is_banned(user) -> bool:
    return getattr(user, "banned_until", None) is not None


def _normalize_role(role: str | None) -> UsuarioRole:
    if role == "admin":
        return UsuarioRole.ADMIN
    if role == "diretor":
        return UsuarioRole.DIRETOR
    return UsuarioRole.USER


def _to_out(user) -> UsuarioOut:
    return UsuarioOut(
        id=str(user.id),
        email=user.email or "",
        role=UsuarioRole(_role_from_user(user)),
        created_at=str(getattr(user, "created_at", "") or ""),
        ativo=not _is_banned(user),
    )


def _row_to_out(row: dict[str, Any]) -> UsuarioOut:
    return UsuarioOut(
        id=str(row["id"]),
        email=str(row.get("email") or ""),
        role=_normalize_role(row.get("role")),
        created_at=str(row.get("created_at") or ""),
        ativo=bool(row.get("ativo", True)),
    )


def _rpc_error(exc: Exception, default: str) -> HTTPException:
    detail = str(exc)
    lower = detail.lower()
    if "já existe" in lower or "already" in lower:
        return HTTPException(status_code=409, detail="Já existe um usuário com este e-mail")
    if "restrito" in lower or "42501" in lower or "permission" in lower:
        return HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return HTTPException(status_code=400, detail=f"{default}: {detail}")


@router.get("/me", response_model=UsuarioOut)
def me(current: Annotated[AuthUser, Depends(get_current_user)]):
    return UsuarioOut(
        id=current.id,
        email=current.email or "",
        role=UsuarioRole(current.role),
        created_at="",
        ativo=True,
    )


@router.get("", response_model=list[UsuarioOut])
def list_usuarios(
    current: Annotated[AuthUser, Depends(require_admin)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    if _has_service_role(settings):
        admin = get_admin_client(settings)
        try:
            response = admin.auth.admin.list_users()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=400,
                detail=f"Falha ao listar usuários: {exc}",
            ) from exc

        users = getattr(response, "users", None)
        if users is None and isinstance(response, list):
            users = response
        return [_to_out(u) for u in (users or [])]

    client = get_user_client(current.access_token, settings)
    try:
        raw = client.rpc("admin_list_usuarios").execute().data
    except Exception as exc:  # noqa: BLE001
        raise _rpc_error(exc, "Falha ao listar usuários") from exc

    if isinstance(raw, str):
        import json

        raw = json.loads(raw)
    if not isinstance(raw, list):
        raw = []
    return [_row_to_out(row) for row in raw]


@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def create_usuario(
    payload: UsuarioCreate,
    current: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    role = payload.role.value if isinstance(payload.role, UsuarioRole) else payload.role
    user_id: str | None = None
    out: UsuarioOut

    if _has_service_role(settings):
        admin = get_admin_client(settings)
        try:
            response = admin.auth.admin.create_user(
                {
                    "email": payload.email.strip().lower(),
                    "password": payload.password,
                    "email_confirm": True,
                    "user_metadata": {"nome": payload.nome} if payload.nome else {},
                    "app_metadata": {
                        "role": role,
                        "must_change_password": True,
                    },
                }
            )
        except Exception as exc:  # noqa: BLE001
            detail = str(exc)
            if "already" in detail.lower() or "registered" in detail.lower():
                raise HTTPException(
                    status_code=409,
                    detail="Já existe um usuário com este e-mail",
                ) from exc
            raise HTTPException(
                status_code=400,
                detail=f"Falha ao criar usuário: {detail}",
            ) from exc

        user = response.user
        if user is None:
            raise HTTPException(status_code=400, detail="Usuário não retornado pela Auth API")
        user_id = str(user.id)
        out = _to_out(user)
    else:
        user_client = get_user_client(current.access_token, settings)
        try:
            raw = (
                user_client.rpc(
                    "admin_create_usuario",
                    {
                        "p_email": payload.email.strip().lower(),
                        "p_password": payload.password,
                        "p_role": role,
                        "p_nome": payload.nome,
                    },
                )
                .execute()
                .data
            )
        except Exception as exc:  # noqa: BLE001
            raise _rpc_error(exc, "Falha ao criar usuário") from exc

        if isinstance(raw, str):
            import json

            raw = json.loads(raw)
        if not isinstance(raw, dict):
            raise HTTPException(status_code=400, detail="Usuário não retornado")
        user_id = str(raw["id"])
        out = _row_to_out(raw)

    if payload.responsavel_id and user_id:
        updated = (
            client.table("responsaveis")
            .update({"auth_user_id": user_id})
            .eq("id", str(payload.responsavel_id))
            .is_("auth_user_id", "null")
            .execute()
            .data
        )
        if not updated:
            if _has_service_role(settings):
                try:
                    get_admin_client(settings).auth.admin.delete_user(user_id)
                except Exception:  # noqa: BLE001
                    pass
            raise HTTPException(
                status_code=400,
                detail="Responsável não encontrado ou já possui login vinculado",
            )

    return out


@router.patch("/{user_id}", response_model=UsuarioOut)
def update_usuario(
    user_id: UUID,
    payload: UsuarioUpdate,
    current: Annotated[AuthUser, Depends(require_admin)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    if str(user_id) == current.id and payload.ativo is False:
        raise HTTPException(
            status_code=400,
            detail="Você não pode desativar o próprio usuário",
        )
    if str(user_id) == current.id and payload.role is not None and payload.role != UsuarioRole.ADMIN:
        raise HTTPException(
            status_code=400,
            detail="Você não pode remover o próprio papel de admin",
        )

    if _has_service_role(settings):
        admin = get_admin_client(settings)
        attributes: dict = {}
        if payload.role is not None:
            attributes["app_metadata"] = {"role": payload.role.value}
        if payload.ativo is False:
            attributes["ban_duration"] = "876000h"
        if payload.ativo is True:
            attributes["ban_duration"] = "none"

        if not attributes:
            raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

        try:
            response = admin.auth.admin.update_user_by_id(str(user_id), attributes)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=400,
                detail=f"Falha ao atualizar usuário: {exc}",
            ) from exc

        user = response.user
        if user is None:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        return _to_out(user)

    if payload.role is None and payload.ativo is None:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

    user_client = get_user_client(current.access_token, settings)
    try:
        raw = (
            user_client.rpc(
                "admin_update_usuario",
                {
                    "p_user_id": str(user_id),
                    "p_role": payload.role.value if payload.role is not None else None,
                    "p_ativo": payload.ativo,
                },
            )
            .execute()
            .data
        )
    except Exception as exc:  # noqa: BLE001
        raise _rpc_error(exc, "Falha ao atualizar usuário") from exc

    if isinstance(raw, str):
        import json

        raw = json.loads(raw)
    if not isinstance(raw, dict):
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return _row_to_out(raw)


@router.post("/bootstrap-admin", response_model=UsuarioOut)
def bootstrap_admin(
    current: Annotated[AuthUser, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    """Promove o usuário logado a admin (primeiro setup / recovery)."""
    if settings.is_production:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bootstrap admin desabilitado em produção",
        )
    if not _has_service_role(settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Bootstrap via API exige SUPABASE_SERVICE_ROLE_KEY. "
                "Promova o admin via SQL em auth.users.raw_app_meta_data."
            ),
        )

    admin = get_admin_client(settings)
    try:
        response = admin.auth.admin.list_users()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    users = getattr(response, "users", None) or []
    has_admin = any(_role_from_user(u) == "admin" for u in users)
    if has_admin and current.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Já existe um admin. Use um admin para gerenciar usuários.",
        )

    try:
        updated = admin.auth.admin.update_user_by_id(
            current.id,
            {"app_metadata": {"role": "admin"}},
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    user = updated.user
    if user is None:
        raise HTTPException(status_code=400, detail="Falha ao promover admin")
    return _to_out(user)
