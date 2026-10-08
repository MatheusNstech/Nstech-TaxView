from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.core.auth import AuthUser, get_current_user, get_db_client, require_admin
from app.core.clock import today_br
from app.schemas.models import (
    EmpresaContatoOut,
    EmpresaContatosPut,
    EmpresaCreate,
    EmpresaGrupoOut,
    EmpresaOut,
    EmpresaUpdate,
)
from app.services.db import constraint_errors, fetch_all, reject_nulls
from app.services.empresas_painel import montar_grupos

router = APIRouter(prefix="/empresas", tags=["empresas"])

DUPLICADA = "Já existe uma empresa com esse CNPJ"


def _competencia_anterior(today: date) -> date:
    return date(today.year - 1, 12, 1) if today.month == 1 else date(today.year, today.month - 1, 1)


@router.get("", response_model=list[EmpresaOut])
def list_empresas(
    _: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
):
    return fetch_all(
        lambda: client.table("empresas").select("*").order("razao_social").order("id")
    )


@router.get("/painel", response_model=list[EmpresaGrupoOut])
def painel_empresas(
    _: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    competencia: date | None = None,
):
    today = today_br()
    comp = (competencia or _competencia_anterior(today)).replace(day=1)
    empresas = fetch_all(
        lambda: client.table("empresas").select("*").eq("ativa", True).order("id")
    )
    contatos = fetch_all(lambda: client.table("empresa_contatos").select("*").order("id"))
    obrigacoes = fetch_all(
        lambda: client.table("obrigacoes")
        .select(
            "id,empresa_id,status,prazo_legal,prazo_fiscal,data_entrega,entrega_original,"
            "responsavel_id,responsaveis(id,nome),"
            "obrigacao_responsaveis(responsavel_id,responsaveis(id,nome))"
        )
        .eq("competencia", comp.isoformat())
        .order("id")
    )
    return montar_grupos(empresas, contatos, obrigacoes, today)


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
    if "nome_fantasia" in body:
        body["nome_fantasia"] = (body["nome_fantasia"] or "").strip() or None
    with constraint_errors(duplicate=DUPLICADA):
        data = client.table("empresas").update(body).eq("id", str(empresa_id)).execute().data
    if not data:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return data[0]


@router.put("/{empresa_id}/contatos", response_model=list[EmpresaContatoOut])
def replace_contatos(
    empresa_id: UUID,
    payload: EmpresaContatosPut,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    existe = client.table("empresas").select("id").eq("id", str(empresa_id)).limit(1).execute().data
    if not existe:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    (
        client.table("empresa_contatos")
        .delete()
        .eq("empresa_id", str(empresa_id))
        .eq("area", payload.area)
        .execute()
    )
    if not payload.contatos:
        return []
    rows = [
        {
            "empresa_id": str(empresa_id),
            "area": payload.area,
            "nome": c.nome,
            "email": c.email,
            "ordem": i,
        }
        for i, c in enumerate(payload.contatos)
    ]
    return client.table("empresa_contatos").insert(rows).execute().data or []


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
