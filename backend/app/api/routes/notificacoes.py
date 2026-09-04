from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.core.auth import AuthUser, get_current_user, get_db_client
from app.schemas.models import NotificacaoOut

router = APIRouter(prefix="/notificacoes", tags=["notificacoes"])


@router.get("", response_model=list[NotificacaoOut])
def list_notificacoes(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    apenas_nao_lidas: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
):
    query = (
        client.table("notificacoes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if apenas_nao_lidas:
        query = query.eq("lida", False)
    return query.execute().data or []


@router.patch("/{notificacao_id}/lida", response_model=NotificacaoOut)
def marcar_lida(
    notificacao_id: UUID,
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
):
    data = (
        client.table("notificacoes")
        .update({"lida": True})
        .eq("id", str(notificacao_id))
        .eq("user_id", user.id)
        .execute()
        .data
    )
    if not data:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    return data[0]


@router.post("/marcar-todas-lidas")
def marcar_todas_lidas(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
):
    client.table("notificacoes").update({"lida": True}).eq("user_id", user.id).eq(
        "lida", False
    ).execute()
    return {"ok": True}
