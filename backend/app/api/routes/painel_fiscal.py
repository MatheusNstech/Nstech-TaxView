from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from supabase import Client

from app.core.auth import (
    AuthUser,
    get_db_client,
    require_painel_fiscal_editor,
    require_painel_fiscal_reader,
)

router = APIRouter(prefix="/painel-fiscal", tags=["painel-fiscal"])

TABLE = "painel_fiscal_pendencias"

# Cadastro Tax: 34 empresas, das quais 3 baixadas.
CADASTRO_TOTAL_EMPRESAS = 34
EMPRESAS_BAIXADAS = frozenset(
    {
        "AVACON",
        "GBM MALHA NORTE",
        "SIGNA",
    }
)


class PainelFiscalOut(BaseModel):
    id: UUID
    empresa: str
    razao_social: str = ""
    situacao_cnpj: str = ""
    cnpj: str = ""
    cidade_iss: str = ""
    uf: str = ""
    orgao: str = ""
    sucedida: str = ""
    data_inscricao: date | None = None
    cnpj_sucedida: str = ""
    empresa_sucedida: str = ""
    natureza: str = ""
    fase: str = ""
    tipo: str = ""
    situacao: str = ""
    codigo: str = ""
    mes: int | None = None
    ano: int | None = None
    periodo_apuracao: str = ""
    vencimento: date | None = None
    principal: Decimal | None = None
    multa: Decimal | None = None
    juros: Decimal | None = None
    total: Decimal | None = None
    motivo: str = ""
    numero_processo: str = ""
    cnd: str = ""
    validade_cnd: date | None = None
    status_cnd: str = ""
    nota_01: str = ""
    nota_02: str = ""


class PainelFiscalCreate(BaseModel):
    empresa: str = Field(min_length=1, max_length=120)
    razao_social: str = ""
    situacao_cnpj: str = ""
    cnpj: str = ""
    cidade_iss: str = ""
    uf: str = ""
    orgao: str = ""
    sucedida: str = ""
    data_inscricao: date | None = None
    cnpj_sucedida: str = ""
    empresa_sucedida: str = ""
    natureza: str = ""
    fase: str = ""
    tipo: str = ""
    situacao: str = ""
    codigo: str = ""
    mes: int | None = None
    ano: int | None = None
    periodo_apuracao: str = ""
    vencimento: date | None = None
    principal: Decimal | None = None
    multa: Decimal | None = None
    juros: Decimal | None = None
    total: Decimal | None = None
    motivo: str = ""
    numero_processo: str = ""
    cnd: str = ""
    validade_cnd: date | None = None
    status_cnd: str = ""
    nota_01: str = ""
    nota_02: str = ""


class PainelFiscalUpdate(BaseModel):
    empresa: str | None = None
    razao_social: str | None = None
    situacao_cnpj: str | None = None
    cnpj: str | None = None
    cidade_iss: str | None = None
    uf: str | None = None
    orgao: str | None = None
    sucedida: str | None = None
    data_inscricao: date | None = None
    cnpj_sucedida: str | None = None
    empresa_sucedida: str | None = None
    natureza: str | None = None
    fase: str | None = None
    tipo: str | None = None
    situacao: str | None = None
    codigo: str | None = None
    mes: int | None = None
    ano: int | None = None
    periodo_apuracao: str | None = None
    vencimento: date | None = None
    principal: Decimal | None = None
    multa: Decimal | None = None
    juros: Decimal | None = None
    total: Decimal | None = None
    motivo: str | None = None
    numero_processo: str | None = None
    cnd: str | None = None
    validade_cnd: date | None = None
    status_cnd: str | None = None
    nota_01: str | None = None
    nota_02: str | None = None


class PainelFiscalSummary(BaseModel):
    total_empresas: int
    ativas: int
    baixadas: int
    cnd_valida: int
    cnd_pendente: int
    com_observacao: int
    por_orgao_count: dict[str, int]
    por_orgao_valor: dict[str, float]
    total_valor: float
    anos: list[int]
    meses: list[int]


def _money(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _normalize_orgao(raw: str) -> str:
    """CADIN_RFB → CADIN; RFB puro → RFB (nunca misturar)."""
    key = (raw or "").strip().upper()
    if "CADIN" in key:
        return "CADIN"
    if "PGFN" in key:
        return "PGFN"
    if key == "RFB":
        return "RFB"
    if "SEM PEND" in key:
        return "Sem Pendência"
    text = (raw or "").strip()
    return text or "—"


def _company_key(row: dict[str, Any]) -> str:
    cnpj = str(row.get("cnpj") or "").strip()
    if cnpj:
        return f"cnpj:{cnpj}"
    return f"emp:{(row.get('empresa') or '').strip().upper()}"


def _empresa_nome(row: dict[str, Any]) -> str:
    return (row.get("empresa") or "").strip().upper()


def _normalize_status_cnd(raw: str) -> str | None:
    text = (raw or "").strip().casefold()
    if "válid" in text or "valid" in text:
        return "Válida"
    if "pend" in text:
        return "Pendente"
    # Vazio ou outro texto: não classifica (não entra em pendente/válida).
    return None


def _payload(body: BaseModel, *, user_id: str | None = None) -> dict[str, Any]:
    data = body.model_dump(exclude_unset=True)
    if "orgao" in data and data["orgao"] is not None:
        data["orgao"] = _normalize_orgao(str(data["orgao"]))
    for key in ("principal", "multa", "juros", "total"):
        if key in data and data[key] is not None:
            data[key] = float(data[key])
    for key in ("data_inscricao", "vencimento", "validade_cnd"):
        if key in data and data[key] is not None:
            data[key] = data[key].isoformat()
    if user_id:
        data["updated_by"] = user_id
    return data


@router.get("/summary", response_model=PainelFiscalSummary)
def summary(
    _: Annotated[AuthUser, Depends(require_painel_fiscal_reader)],
    client: Annotated[Client, Depends(get_db_client)],
    ano: int | None = None,
    mes: int | None = None,
):
    query = client.table(TABLE).select(
        "empresa,cnpj,situacao_cnpj,orgao,total,status_cnd,nota_01,nota_02,ano,mes"
    )
    if ano is not None:
        query = query.eq("ano", ano)
    if mes is not None:
        query = query.eq("mes", mes)
    rows = query.execute().data or []

    # Census oficial do painel Tax: 34 empresas, 3 baixadas.
    baixadas = len(EMPRESAS_BAIXADAS)
    total_empresas = CADASTRO_TOTAL_EMPRESAS
    ativas = max(total_empresas - baixadas, 0)

    # CND por empresa (pior status prevalece: Pendente > Válida).
    # Só status explícito; vazio não conta.
    cnd_by_company: dict[str, str] = {}
    com_obs: set[str] = set()
    for row in rows:
        key = _empresa_nome(row) or _company_key(row)
        status_norm = _normalize_status_cnd(str(row.get("status_cnd") or ""))
        if status_norm is not None:
            prev = cnd_by_company.get(key)
            if prev != "Pendente":
                if status_norm == "Pendente" or prev is None:
                    cnd_by_company[key] = status_norm
        nota_01 = str(row.get("nota_01") or "").strip()
        nota_02 = str(row.get("nota_02") or "").strip()
        if nota_01 or nota_02:
            com_obs.add(key)

    cnd_valida = sum(1 for s in cnd_by_company.values() if s == "Válida")
    cnd_pendente = sum(1 for s in cnd_by_company.values() if s == "Pendente")
    com_observacao = len(com_obs)

    por_count: dict[str, int] = {}
    por_valor: dict[str, float] = {}
    # Contagem de empresas distintas por órgão (não linhas)
    orgao_companies: dict[str, set[str]] = {}
    total_valor = 0.0
    anos: set[int] = set()
    meses: set[int] = set()

    for row in rows:
        orgao = _normalize_orgao(str(row.get("orgao") or ""))
        key = _empresa_nome(row) or _company_key(row)
        orgao_companies.setdefault(orgao, set()).add(key)
        valor = _money(row.get("total"))
        por_valor[orgao] = por_valor.get(orgao, 0.0) + valor
        # TOTAL R$ do painel: só CADIN + PGFN + RFB
        if orgao in {"CADIN", "PGFN", "RFB"}:
            total_valor += valor
        if row.get("ano") is not None:
            anos.add(int(row["ano"]))
        if row.get("mes") is not None:
            meses.add(int(row["mes"]))

    for orgao, keys in orgao_companies.items():
        por_count[orgao] = len(keys)

    # Garante chaves estáveis para o front (mesmo zeradas)
    for key in ("CADIN", "PGFN", "RFB", "Sem Pendência"):
        por_count.setdefault(key, 0)
        por_valor.setdefault(key, 0.0)

    return PainelFiscalSummary(
        total_empresas=total_empresas,
        ativas=ativas,
        baixadas=baixadas,
        cnd_valida=cnd_valida,
        cnd_pendente=cnd_pendente,
        com_observacao=com_observacao,
        por_orgao_count=por_count,
        por_orgao_valor={k: round(v, 2) for k, v in por_valor.items()},
        total_valor=round(total_valor, 2),
        anos=sorted(anos, reverse=True),
        meses=sorted(meses),
    )


@router.get("", response_model=list[PainelFiscalOut])
def list_pendencias(
    _: Annotated[AuthUser, Depends(require_painel_fiscal_reader)],
    client: Annotated[Client, Depends(get_db_client)],
    ano: int | None = None,
    mes: int | None = None,
    orgao: str | None = None,
    empresa: str | None = None,
    status_cnd: str | None = None,
    limit: int = Query(default=2000, ge=1, le=5000),
):
    query = client.table(TABLE).select("*").order("empresa").order("ano", desc=True)
    if ano is not None:
        query = query.eq("ano", ano)
    if mes is not None:
        query = query.eq("mes", mes)
    if orgao:
        query = query.eq("orgao", orgao)
    if empresa:
        query = query.ilike("empresa", f"%{empresa}%")
    if status_cnd:
        query = query.ilike("status_cnd", f"%{status_cnd}%")
    rows = query.limit(limit).execute().data or []
    return [PainelFiscalOut.model_validate(row) for row in rows]


@router.post("", response_model=PainelFiscalOut, status_code=status.HTTP_201_CREATED)
def create_pendencia(
    body: PainelFiscalCreate,
    user: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
):
    payload = _payload(body, user_id=user.id)
    result = client.table(TABLE).insert(payload).execute().data or []
    if not result:
        raise HTTPException(status_code=400, detail="Falha ao criar registro")
    return PainelFiscalOut.model_validate(result[0])


@router.patch("/{item_id}", response_model=PainelFiscalOut)
def update_pendencia(
    item_id: UUID,
    body: PainelFiscalUpdate,
    user: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
):
    payload = _payload(body, user_id=user.id)
    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    result = (
        client.table(TABLE)
        .update(payload)
        .eq("id", str(item_id))
        .execute()
        .data
        or []
    )
    if not result:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    return PainelFiscalOut.model_validate(result[0])
