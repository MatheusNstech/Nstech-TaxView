"""Acompanhamento de processos PER/DCOMP (Receita Federal)."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from supabase import Client

from app.core.auth import (
    AuthUser,
    get_db_client,
    require_perdcomp_editor,
    require_perdcomp_reader,
)
from app.core.clock import today_br
from app.services.db import constraint_errors, fetch_all

router = APIRouter(prefix="/perdcomp", tags=["perdcomp"])

TABLE = "perdcomp_processos"
SEM_STATUS = "Sem status"
DUPLICADO = "JÃ¡ existe um processo com esse PER/DCOMP"
TEXT_FIELDS = (
    "processo",
    "empresa",
    "tributo_credito",
    "periodo",
    "status",
    "observacoes",
    "prazo_cumprimento",
    "data_base_ciencia",
    "providencia",
)
# numeric(18, 2)
ValorPedido = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=2)]


def _strip_perdcomp_value(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    if not text:
        raise ValueError("Informe o nÃºmero do PER/DCOMP")
    return text

PrazoSituacao = Literal["vencido", "vence_7d", "no_prazo", "sem_prazo"]
PrazoFiltro = Literal["vencido", "7d", "30d", "sem_prazo"]


class PerdcompBase(BaseModel):
    processo: str = ""
    empresa: str = ""
    tributo_credito: str = ""
    periodo: str = ""
    valor_pedido: ValorPedido | None = None
    status: str = ""
    observacoes: str = ""
    prazo_cumprimento: str = ""
    data_base_ciencia: str = ""
    data_limite: date | None = None
    providencia: str = ""


class PerdcompCreate(PerdcompBase):
    perdcomp: str = Field(min_length=1, max_length=80)

    @field_validator("perdcomp")
    @classmethod
    def _strip_perdcomp(cls, value: str) -> str:
        return _strip_perdcomp_value(value)


class PerdcompUpdate(BaseModel):
    perdcomp: str | None = Field(default=None, min_length=1, max_length=80)
    processo: str | None = None
    empresa: str | None = None
    tributo_credito: str | None = None
    periodo: str | None = None
    valor_pedido: ValorPedido | None = None
    status: str | None = None
    observacoes: str | None = None
    prazo_cumprimento: str | None = None
    data_base_ciencia: str | None = None
    data_limite: date | None = None
    providencia: str | None = None

    @field_validator("perdcomp")
    @classmethod
    def _strip_perdcomp(cls, value: str | None) -> str | None:
        return _strip_perdcomp_value(value)


class PerdcompOut(PerdcompBase):
    id: UUID
    perdcomp: str
    valor_pedido: Decimal | None = None
    prazo_situacao: PrazoSituacao
    dias_para_prazo: int | None = None
    updated_at: str | None = None


class StatusAgg(BaseModel):
    status: str
    quantidade: int
    valor: float


class EmpresaAgg(BaseModel):
    empresa: str
    quantidade: int
    valor: float


class PrazosAgg(BaseModel):
    vencidos: int
    vence_7d: int
    vence_30d: int
    sem_prazo: int


class PerdcompSummary(BaseModel):
    total_processos: int
    valor_total: float
    valor_indeferido: float
    por_status: list[StatusAgg]
    por_empresa: list[EmpresaAgg]
    prazos: PrazosAgg


def _money(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _parse_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def status_label(raw: Any) -> str:
    text = str(raw or "").strip()
    return text or SEM_STATUS


def prazo_situacao(data_limite: date | None, today: date | None = None) -> PrazoSituacao:
    if data_limite is None:
        return "sem_prazo"
    today = today or today_br()
    if data_limite < today:
        return "vencido"
    if data_limite <= today + timedelta(days=7):
        return "vence_7d"
    return "no_prazo"


def _matches_prazo(
    data_limite: date | None, filtro: PrazoFiltro, today: date
) -> bool:
    if filtro == "sem_prazo":
        return data_limite is None
    if data_limite is None:
        return False
    if filtro == "vencido":
        return data_limite < today
    horizon = 7 if filtro == "7d" else 30
    return today <= data_limite <= today + timedelta(days=horizon)


def _to_out(row: dict[str, Any], today: date | None = None) -> PerdcompOut:
    today = today or today_br()
    limite = _parse_date(row.get("data_limite"))
    return PerdcompOut(
        id=row["id"],
        perdcomp=str(row.get("perdcomp") or ""),
        processo=str(row.get("processo") or ""),
        empresa=str(row.get("empresa") or ""),
        tributo_credito=str(row.get("tributo_credito") or ""),
        periodo=str(row.get("periodo") or ""),
        valor_pedido=row.get("valor_pedido"),
        status=str(row.get("status") or ""),
        observacoes=str(row.get("observacoes") or ""),
        prazo_cumprimento=str(row.get("prazo_cumprimento") or ""),
        data_base_ciencia=str(row.get("data_base_ciencia") or ""),
        data_limite=limite,
        providencia=str(row.get("providencia") or ""),
        prazo_situacao=prazo_situacao(limite, today),
        dias_para_prazo=(limite - today).days if limite else None,
        updated_at=row.get("updated_at"),
    )


def build_summary(rows: list[dict[str, Any]], today: date | None = None) -> PerdcompSummary:
    today = today or today_br()
    por_status: dict[str, list[float]] = {}
    por_empresa: dict[str, list[float]] = {}
    valor_total = 0.0
    valor_indeferido = 0.0
    prazos = {"vencidos": 0, "vence_7d": 0, "vence_30d": 0, "sem_prazo": 0}

    for row in rows:
        valor = _money(row.get("valor_pedido"))
        valor_total += valor
        label = status_label(row.get("status"))
        if label.casefold().startswith("indeferid"):
            valor_indeferido += valor
        bucket = por_status.setdefault(label, [0, 0.0])
        bucket[0] += 1
        bucket[1] += valor

        empresa = str(row.get("empresa") or "").strip() or "â€”"
        emp_bucket = por_empresa.setdefault(empresa, [0, 0.0])
        emp_bucket[0] += 1
        emp_bucket[1] += valor

        limite = _parse_date(row.get("data_limite"))
        if limite is None:
            prazos["sem_prazo"] += 1
        elif limite < today:
            prazos["vencidos"] += 1
        else:
            if limite <= today + timedelta(days=7):
                prazos["vence_7d"] += 1
            if limite <= today + timedelta(days=30):
                prazos["vence_30d"] += 1

    return PerdcompSummary(
        total_processos=len(rows),
        valor_total=round(valor_total, 2),
        valor_indeferido=round(valor_indeferido, 2),
        por_status=sorted(
            (
                StatusAgg(status=k, quantidade=int(v[0]), valor=round(v[1], 2))
                for k, v in por_status.items()
            ),
            key=lambda s: (-s.valor, s.status),
        ),
        por_empresa=sorted(
            (
                EmpresaAgg(empresa=k, quantidade=int(v[0]), valor=round(v[1], 2))
                for k, v in por_empresa.items()
            ),
            key=lambda e: (-e.valor, e.empresa),
        ),
        prazos=PrazosAgg(**prazos),
    )


def _payload(body: BaseModel, *, user_id: str | None = None) -> dict[str, Any]:
    data = body.model_dump(exclude_unset=True)
    if data.get("perdcomp", "") is None:
        data.pop("perdcomp")
    for key in TEXT_FIELDS:
        if key in data and data[key] is None:
            data[key] = ""
    if "valor_pedido" in data and data["valor_pedido"] is not None:
        data["valor_pedido"] = float(data["valor_pedido"])
    if "data_limite" in data and data["data_limite"] is not None:
        data["data_limite"] = data["data_limite"].isoformat()
    for key, value in list(data.items()):
        if isinstance(value, str):
            data[key] = value.strip()
    if user_id:
        data["updated_by"] = user_id
    return data


def _fetch_all(client: Client) -> list[dict[str, Any]]:
    return fetch_all(lambda: client.table(TABLE).select("*").order("data_limite").order("id"))


@router.get("/summary", response_model=PerdcompSummary)
def summary(
    _: Annotated[AuthUser, Depends(require_perdcomp_reader)],
    client: Annotated[Client, Depends(get_db_client)],
):
    return build_summary(_fetch_all(client))


@router.get("", response_model=list[PerdcompOut])
def list_processos(
    _: Annotated[AuthUser, Depends(require_perdcomp_reader)],
    client: Annotated[Client, Depends(get_db_client)],
    status_filtro: Annotated[str | None, Query(alias="status")] = None,
    empresa: str | None = None,
    prazo: PrazoFiltro | None = None,
):
    today = today_br()
    rows = _fetch_all(client)
    out: list[PerdcompOut] = []
    empresa_key = (empresa or "").strip().casefold()
    status_key = (status_filtro or "").strip().casefold()
    for row in rows:
        if status_key and status_label(row.get("status")).casefold() != status_key:
            continue
        if empresa_key and empresa_key not in str(row.get("empresa") or "").casefold():
            continue
        if prazo and not _matches_prazo(_parse_date(row.get("data_limite")), prazo, today):
            continue
        out.append(_to_out(row, today))
    out.sort(
        key=lambda p: (
            p.data_limite is None,
            p.data_limite or date.max,
            p.empresa,
        )
    )
    return out


@router.post("", response_model=PerdcompOut, status_code=status.HTTP_201_CREATED)
def create_processo(
    body: PerdcompCreate,
    user: Annotated[AuthUser, Depends(require_perdcomp_editor)],
    client: Annotated[Client, Depends(get_db_client)],
):
    existing = (
        client.table(TABLE)
        .select("id")
        .eq("perdcomp", body.perdcomp)
        .limit(1)
        .execute()
        .data
        or []
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=DUPLICADO)
    with constraint_errors(duplicate=DUPLICADO):
        result = client.table(TABLE).insert(_payload(body, user_id=user.id)).execute().data or []
    if not result:
        raise HTTPException(status_code=400, detail="Falha ao criar processo")
    return _to_out(result[0])


@router.patch("/{item_id}", response_model=PerdcompOut)
def update_processo(
    item_id: UUID,
    body: PerdcompUpdate,
    user: Annotated[AuthUser, Depends(require_perdcomp_editor)],
    client: Annotated[Client, Depends(get_db_client)],
):
    payload = _payload(body, user_id=user.id)
    if set(payload) <= {"updated_by"}:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    with constraint_errors(duplicate=DUPLICADO):
        result = (
            client.table(TABLE).update(payload).eq("id", str(item_id)).execute().data or []
        )
    if not result:
        raise HTTPException(status_code=404, detail="Processo nÃ£o encontrado")
    return _to_out(result[0])


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_processo(
    item_id: UUID,
    _: Annotated[AuthUser, Depends(require_perdcomp_editor)],
    client: Annotated[Client, Depends(get_db_client)],
):
    result = client.table(TABLE).delete().eq("id", str(item_id)).execute().data or []
    if not result:
        raise HTTPException(status_code=404, detail="Processo nÃ£o encontrado")
