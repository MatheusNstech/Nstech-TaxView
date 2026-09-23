"""Recepção de valores de faturamento (app desktop).

POST /api/valores — upsert por (empresa_cnpj, competencia, tipo).
Só grava/atualiza quando o payload canônico for diferente.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field, field_validator
from supabase import Client

from app.core.auth import AuthUser, get_current_user, get_db_client

router = APIRouter(prefix="/valores", tags=["valores"])

TABLE = "valores_faturamento"
TipoValor = Literal["iss", "pis_cofins"]


class ValorIngest(BaseModel):
    competencia: date
    tipo: TipoValor
    empresa_cnpj: str = Field(min_length=11, max_length=18)
    empresa_alias: str = Field(default="", max_length=120)
    empresa_razao: str = Field(default="", max_length=200)
    origem: str = Field(default="desktop", min_length=1, max_length=80)
    valores: dict[str, Any] = Field(default_factory=dict)

    @field_validator("empresa_cnpj")
    @classmethod
    def _normalize_cnpj(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value or "")
        if len(digits) not in (11, 14):
            raise ValueError("CNPJ/CPF deve ter 11 ou 14 dígitos")
        return digits

    @field_validator("competencia")
    @classmethod
    def _first_day(cls, value: date) -> date:
        return value.replace(day=1)

    @field_validator("origem", "empresa_alias", "empresa_razao")
    @classmethod
    def _strip(cls, value: str) -> str:
        return (value or "").strip()


class ValorOut(BaseModel):
    id: UUID
    changed: bool
    action: Literal["created", "updated", "unchanged"]
    competencia: date
    tipo: TipoValor
    empresa_cnpj: str
    empresa_alias: str
    empresa_razao: str = ""
    origem: str
    payload: dict[str, Any]
    created_by: UUID | None = None
    created_at: str | None = None
    updated_at: str | None = None


def _require_valores_access(user: AuthUser) -> AuthUser:
    if user.role not in ("admin", "diretor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a admin/diretor",
        )
    return user


def _canonical_payload(valores: dict[str, Any]) -> dict[str, Any]:
    """Normaliza números (2 casas) e ordena chaves para comparação estável."""

    def norm(obj: Any) -> Any:
        if isinstance(obj, bool) or obj is None:
            return obj
        if isinstance(obj, int) and not isinstance(obj, bool):
            return obj
        if isinstance(obj, float):
            return round(obj, 2)
        if isinstance(obj, str):
            return obj.strip()
        if isinstance(obj, dict):
            return {str(k): norm(v) for k, v in sorted(obj.items())}
        if isinstance(obj, list):
            return [norm(item) for item in obj]
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        try:
            return round(float(obj), 2)
        except (TypeError, ValueError):
            return str(obj)

    return norm(valores or {})


def _payloads_equal(left: dict[str, Any], right: dict[str, Any]) -> bool:
    return json.dumps(_canonical_payload(left), sort_keys=True, ensure_ascii=False) == json.dumps(
        _canonical_payload(right), sort_keys=True, ensure_ascii=False
    )


def _parse_date(value: Any) -> date:
    text = str(value)[:10]
    return date.fromisoformat(text)


def _row_to_out(
    saved: dict[str, Any],
    *,
    changed: bool,
    action: Literal["created", "updated", "unchanged"],
) -> ValorOut:
    return ValorOut(
        id=UUID(str(saved["id"])),
        changed=changed,
        action=action,
        competencia=_parse_date(saved["competencia"]),
        tipo=saved["tipo"],  # type: ignore[arg-type]
        empresa_cnpj=str(saved.get("empresa_cnpj") or ""),
        empresa_alias=str(saved.get("empresa_alias") or ""),
        empresa_razao=str(saved.get("empresa_razao") or ""),
        origem=str(saved.get("origem") or "desktop"),
        payload=saved.get("payload") or {},
        created_by=UUID(str(saved["created_by"])) if saved.get("created_by") else None,
        created_at=str(saved["created_at"]) if saved.get("created_at") else None,
        updated_at=str(saved["updated_at"]) if saved.get("updated_at") else None,
    )


def _find_existing(
    client: Client,
    *,
    empresa_cnpj: str,
    competencia: date,
    tipo: str,
) -> dict[str, Any] | None:
    rows = (
        client.table(TABLE)
        .select("*")
        .eq("empresa_cnpj", empresa_cnpj)
        .eq("competencia", competencia.isoformat())
        .eq("tipo", tipo)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


@router.post("", response_model=ValorOut)
def ingest_valor(
    body: ValorIngest,
    response: Response,
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
):
    _require_valores_access(user)
    payload = _canonical_payload(body.valores)
    now = datetime.now(timezone.utc).isoformat()

    existing = _find_existing(
        client,
        empresa_cnpj=body.empresa_cnpj,
        competencia=body.competencia,
        tipo=body.tipo,
    )

    if existing is None:
        row = {
            "competencia": body.competencia.isoformat(),
            "tipo": body.tipo,
            "empresa_cnpj": body.empresa_cnpj,
            "empresa_alias": body.empresa_alias,
            "empresa_razao": body.empresa_razao,
            "origem": body.origem or "desktop",
            "referencia": body.empresa_cnpj,
            "payload": payload,
            "created_by": user.id,
            "updated_at": now,
        }
        result = client.table(TABLE).insert(row).execute()
        data = getattr(result, "data", None) or []
        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não foi possível gravar o valor",
            )
        response.status_code = status.HTTP_201_CREATED
        return _row_to_out(data[0], changed=True, action="created")

    if _payloads_equal(existing.get("payload") or {}, payload):
        # Atualiza metadados leves se alias/razão mudarem, sem marcar changed
        meta_changed = (
            str(existing.get("empresa_alias") or "") != body.empresa_alias
            or str(existing.get("empresa_razao") or "") != body.empresa_razao
            or str(existing.get("origem") or "") != (body.origem or "desktop")
        )
        if meta_changed:
            updated = (
                client.table(TABLE)
                .update(
                    {
                        "empresa_alias": body.empresa_alias,
                        "empresa_razao": body.empresa_razao,
                        "origem": body.origem or "desktop",
                        "updated_at": now,
                    }
                )
                .eq("id", existing["id"])
                .execute()
            )
            data = getattr(updated, "data", None) or []
            saved = data[0] if data else {**existing, "empresa_alias": body.empresa_alias}
            response.status_code = status.HTTP_200_OK
            return _row_to_out(saved, changed=False, action="unchanged")

        response.status_code = status.HTTP_200_OK
        return _row_to_out(existing, changed=False, action="unchanged")

    updated = (
        client.table(TABLE)
        .update(
            {
                "empresa_alias": body.empresa_alias,
                "empresa_razao": body.empresa_razao,
                "origem": body.origem or "desktop",
                "referencia": body.empresa_cnpj,
                "payload": payload,
                "updated_at": now,
            }
        )
        .eq("id", existing["id"])
        .execute()
    )
    data = getattr(updated, "data", None) or []
    if not data:
        # Alguns clients PostgREST precisam de select explícito
        refreshed = _find_existing(
            client,
            empresa_cnpj=body.empresa_cnpj,
            competencia=body.competencia,
            tipo=body.tipo,
        )
        if refreshed is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não foi possível atualizar o valor",
            )
        saved = refreshed
    else:
        saved = data[0]
    response.status_code = status.HTTP_200_OK
    return _row_to_out(saved, changed=True, action="updated")


@router.get("", response_model=list[ValorOut])
def list_valores(
    user: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    limit: int = Query(default=50, ge=1, le=200),
    competencia: date | None = Query(default=None),
    tipo: TipoValor | None = Query(default=None),
    empresa_cnpj: str | None = Query(default=None),
):
    _require_valores_access(user)
    query = client.table(TABLE).select("*")
    if competencia is not None:
        query = query.eq("competencia", competencia.replace(day=1).isoformat())
    if tipo is not None:
        query = query.eq("tipo", tipo)
    if empresa_cnpj:
        digits = re.sub(r"\D", "", empresa_cnpj)
        if digits:
            query = query.eq("empresa_cnpj", digits)
    rows = (
        query.order("competencia", desc=True)
        .order("empresa_alias")
        .limit(limit)
        .execute()
        .data
        or []
    )
    return [
        _row_to_out(saved, changed=False, action="unchanged")
        for saved in rows
    ]
