from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.core.auth import AuthUser, get_current_user, get_db_client, require_admin
from app.schemas.models import ResponsavelCreate, ResponsavelOut, ResponsavelUpdate

router = APIRouter(prefix="/responsaveis", tags=["responsaveis"])


@router.get("", response_model=list[ResponsavelOut])
def list_responsaveis(
    _: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
):
    return client.table("responsaveis").select("*").order("nome").execute().data or []


@router.post("", response_model=ResponsavelOut, status_code=status.HTTP_201_CREATED)
def create_responsavel(
    payload: ResponsavelCreate,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    data = client.table("responsaveis").insert(payload.model_dump()).execute().data
    if not data:
        raise HTTPException(status_code=400, detail="Falha ao criar responsável")
    return data[0]


@router.patch("/{responsavel_id}", response_model=ResponsavelOut)
def update_responsavel(
    responsavel_id: UUID,
    payload: ResponsavelUpdate,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    body = payload.model_dump(exclude_unset=True)
    data = (
        client.table("responsaveis").update(body).eq("id", str(responsavel_id)).execute().data
    )
    if not data:
        raise HTTPException(status_code=404, detail="Responsável não encontrado")
    return data[0]


@router.delete("/{responsavel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_responsavel(
    responsavel_id: UUID,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    client.table("responsaveis").delete().eq("id", str(responsavel_id)).execute()
