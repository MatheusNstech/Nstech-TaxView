from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.core.auth import AuthUser, get_current_user, get_db_client, require_admin
from app.schemas.models import EmpresaCreate, EmpresaOut, EmpresaUpdate
from app.services.db import constraint_errors, fetch_all, reject_nulls

router = APIRouter(prefix="/empresas", tags=["empresas"])

DUPLICADA = "Já existe uma empresa com esse CNPJ"


@router.get("", response_model=list[EmpresaOut])
def list_empresas(
    _: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
):
    return fetch_all(
        lambda: client.table("empresas").select("*").order("razao_social").order("id")
    )


@router.post("", response_model=EmpresaOut, status_code=status.HTTP_201_CREATED)
def create_empresa(
    payload: EmpresaCreate,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    with constraint_errors(duplicate=DUPLICADA):
        data = client.table("empresas").insert(payload.model_dump()).execute().data
    if not data:
        raise HTTPException(status_code=400, detail="Falha ao criar empresa")
    return data[0]


@router.patch("/{empresa_id}", response_model=EmpresaOut)
def update_empresa(
    empresa_id: UUID,
    payload: EmpresaUpdate,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    body = payload.model_dump(exclude_unset=True)
    reject_nulls(body, ("cnpj", "razao_social", "bu", "ativa"))
    with constraint_errors(duplicate=DUPLICADA):
        data = client.table("empresas").update(body).eq("id", str(empresa_id)).execute().data
    if not data:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return data[0]


@router.delete("/{empresa_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_empresa(
    empresa_id: UUID,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    # obrigacoes.empresa_id é ON DELETE CASCADE: excluir levaria obrigações,
    # comentários e auditoria junto.
    vinculadas = (
        client.table("obrigacoes")
        .select("id")
        .eq("empresa_id", str(empresa_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if vinculadas:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Empresa possui obrigações; desative-a em vez de excluir",
        )
    client.table("empresas").delete().eq("id", str(empresa_id)).execute()
