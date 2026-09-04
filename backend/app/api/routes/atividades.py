from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.core.auth import AuthUser, get_current_user, get_db_client, require_admin
from app.schemas.models import AtividadeCreate, AtividadeOut, AtividadeUpdate

router = APIRouter(prefix="/atividades", tags=["atividades"])


@router.get("", response_model=list[AtividadeOut])
def list_atividades(
    _: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
):
    return client.table("atividades_modelo").select("*").order("nome").execute().data or []


@router.post("", response_model=AtividadeOut, status_code=status.HTTP_201_CREATED)
def create_atividade(
    payload: AtividadeCreate,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    data = client.table("atividades_modelo").insert(payload.model_dump()).execute().data
    if not data:
        raise HTTPException(status_code=400, detail="Falha ao criar atividade")
    return data[0]


@router.patch("/{atividade_id}", response_model=AtividadeOut)
def update_atividade(
    atividade_id: UUID,
    payload: AtividadeUpdate,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    body = payload.model_dump(exclude_unset=True)
    data = (
        client.table("atividades_modelo")
        .update(body)
        .eq("id", str(atividade_id))
        .execute()
        .data
    )
    if not data:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    return data[0]


@router.delete("/{atividade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_atividade(
    atividade_id: UUID,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    client.table("atividades_modelo").delete().eq("id", str(atividade_id)).execute()
