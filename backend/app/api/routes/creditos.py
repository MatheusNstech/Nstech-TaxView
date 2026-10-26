"""Controle de Créditos Tributários — API + SELIC global."""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from supabase import Client

from app.core.auth import (
    AuthUser,
    get_db_client,
    require_painel_fiscal_editor,
    require_painel_fiscal_reader,
)
from app.core.clock import today_br
from app.services.creditos_engine import (
    MovimentoCalculado,
    agregar_compensacoes,
    calcular_ledger,
    money,
    month_start,
    montar_consolidada,
)
from app.services.creditos_import import (
    build_modelo_xlsx,
    parse_creditos_bytes,
    so_digitos_cnpj,
)
from app.services.creditos_persist import apply_import
from app.services.db import constraint_errors, fetch_all

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/creditos", tags=["creditos"])
selic_router = APIRouter(prefix="/selic", tags=["selic"])

MAX_UPLOAD_BYTES = 12 * 1024 * 1024
CONTROLE = "credito_controles"
CADASTRO = "credito_cadastros"
COMP = "credito_compensacoes"
MOV = "credito_movimentos"
SELIC = "selic_taxas"


# ---------- schemas ----------


class ControleUpdate(BaseModel):
    conta_contabil: str | None = None
    descricao_conta: str | None = None
    competencia_atual: date | None = None


class CadastroUpsert(BaseModel):
    codigo_interno: int = Field(ge=1, le=20)
    tipo_credito: str = ""
    tributo: str = ""
    ano_calendario: int | None = None
    credito_original_inicial: Decimal = Decimal("0")
    data_inicio_atualizacao: date | None = None
    na_consolidada: bool = False
    ativo: bool = True
    observacao: str = ""


class CompensacaoCreate(BaseModel):
    # data real da compensação; a competência (dia 1) é derivada dela
    competencia: date
    valor: Decimal = Field(ge=0)
    multa: Decimal = Decimal("0")
    juros_evento: Decimal = Decimal("0")
    numero_dcomp: str = Field(default="", max_length=60)
    cod_receita: str = Field(default="", max_length=20)
    debito_compensado: str = Field(default="", max_length=200)


class CompensacaoUpdate(BaseModel):
    competencia: date | None = None
    valor: Decimal | None = Field(default=None, ge=0)
    multa: Decimal | None = None
    juros_evento: Decimal | None = None
    numero_dcomp: str | None = Field(default=None, max_length=60)
    cod_receita: str | None = Field(default=None, max_length=20)
    debito_compensado: str | None = Field(default=None, max_length=200)


class SelicItem(BaseModel):
    competencia: date
    taxa_mensal: Decimal = Field(ge=0)  # fração (0.01 = 1%)
    fonte: str = "manual"


class SelicBulk(BaseModel):
    itens: list[SelicItem]


# ---------- helpers ----------


def _load_selic_map(client: Client) -> dict[date, Decimal]:
    rows = fetch_all(lambda: client.table(SELIC).select("competencia,taxa_mensal").order("competencia"))
    out: dict[date, Decimal] = {}
    for r in rows:
        comp = date.fromisoformat(str(r["competencia"])[:10])
        out[month_start(comp)] = Decimal(str(r["taxa_mensal"]))
    return out


def _ensure_controle(client: Client, empresa_id: UUID, user: AuthUser) -> dict[str, Any]:
    rows = (
        client.table(CONTROLE)
        .select("*")
        .eq("empresa_id", str(empresa_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if rows:
        return rows[0]
    payload = {
        "empresa_id": str(empresa_id),
        "conta_contabil": "113359",
        "descricao_conta": "Saldo Negativo de Anos Anteriores",
        "updated_by": str(user.id),
    }
    created = client.table(CONTROLE).insert(payload).execute().data
    if not created:
        raise HTTPException(500, "Falha ao criar controle de créditos")
    return created[0]


def _persist_movimentos(
    client: Client,
    credito_id: str,
    movimentos: list[MovimentoCalculado],
) -> None:
    client.table(MOV).delete().eq("credito_id", credito_id).execute()
    if not movimentos:
        return
    rows = []
    for m in movimentos:
        rows.append(
            {
                "credito_id": credito_id,
                "competencia": m.competencia.isoformat(),
                "selic_mensal": float(m.selic_mensal),
                "selic_acumulada": float(m.selic_acumulada),
                "credito_original": float(m.credito_original),
                "saldo_atualizado": float(m.saldo_atualizado),
                "principal": float(m.principal),
                "juros": float(m.juros),
                "total_compensado": float(m.total_compensado),
                "credito_remanescente": float(m.credito_remanescente),
                "credito_original_utilizado": float(m.credito_original_utilizado),
                "credito_original_remanescente": float(m.credito_original_remanescente),
                "atualiz_mes": float(m.atualiz_mes),
            }
        )
    for i in range(0, len(rows), 200):
        client.table(MOV).insert(rows[i : i + 200]).execute()


def _recalcular_credito(
    client: Client,
    cadastro: dict[str, Any],
    selic: dict[date, Decimal],
    competencia_fim: date | None = None,
) -> list[MovimentoCalculado]:
    credito_id = str(cadastro["id"])
    eventos = fetch_all(
        lambda: client.table(COMP)
        .select("competencia,valor,multa,juros_evento")
        .eq("credito_id", credito_id)
        .order("competencia")
    )
    comps = agregar_compensacoes(eventos)
    inicio = cadastro.get("data_inicio_atualizacao")
    if not inicio:
        return []
    if isinstance(inicio, str):
        inicio_d = date.fromisoformat(inicio[:10])
    else:
        inicio_d = inicio
    fim = competencia_fim or today_br().replace(day=1)
    # estende até o último evento ou competência pedida
    if comps:
        fim = max(fim, max(comps.keys()))
    if selic:
        fim = max(fim, max(selic.keys()))
    movimentos = calcular_ledger(
        credito_original_inicial=Decimal(str(cadastro.get("credito_original_inicial") or 0)),
        data_inicio=inicio_d,
        data_fim=fim,
        selic_por_mes=selic,
        compensacoes_por_mes=comps,
    )
    _persist_movimentos(client, credito_id, movimentos)
    return movimentos


def _recalcular_todos(client: Client) -> int:
    """SELIC é global: qualquer mudança na tabela recalcula o ledger de todos os créditos."""
    selic = _load_selic_map(client)
    controles = {
        c["id"]: c
        for c in fetch_all(lambda: client.table(CONTROLE).select("id,competencia_atual"))
    }
    cads = fetch_all(lambda: client.table(CADASTRO).select("*").order("controle_id"))
    for cad in cads:
        controle = controles.get(cad.get("controle_id")) or {}
        fim = _parse_date(controle.get("competencia_atual")) or today_br().replace(day=1)
        _recalcular_credito(client, cad, selic, fim)
    return len(cads)


def _status_credito(mov: MovimentoCalculado | None, na_cons: bool) -> str:
    if not na_cons:
        return "fora_consolidada"
    if mov is None:
        return "disponivel"
    if mov.credito_remanescente <= 0 and mov.saldo_atualizado <= 0 and mov.total_compensado > 0:
        return "esgotado"
    if mov.total_compensado > 0 and mov.credito_remanescente > 0:
        return "em_uso"
    if mov.credito_remanescente > 0 or mov.saldo_atualizado > 0:
        return "disponivel"
    return "esgotado"


# ---------- SELIC ----------


@selic_router.get("")
def list_selic(
    _: Annotated[AuthUser, Depends(require_painel_fiscal_reader)],
    client: Annotated[Client, Depends(get_db_client)],
    de: date | None = None,
    ate: date | None = None,
):
    def q():
        b = client.table(SELIC).select("*").order("competencia")
        if de:
            b = b.gte("competencia", month_start(de).isoformat())
        if ate:
            b = b.lte("competencia", month_start(ate).isoformat())
        return b

    rows = fetch_all(q)
    for r in rows:
        # UI: também devolve % amigável
        taxa = Decimal(str(r.get("taxa_mensal") or 0))
        r["taxa_percentual"] = float(money(taxa * 100))
    return rows


@selic_router.put("")
def upsert_selic(
    body: SelicBulk,
    user: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
):
    if not body.itens:
        raise HTTPException(400, "Informe ao menos uma taxa")
    rows = []
    for item in body.itens:
        taxa = Decimal(str(item.taxa_mensal))
        # aceita % (>=1) ou fração
        if taxa >= 1:
            taxa = taxa / Decimal("100")
        rows.append(
            {
                "competencia": month_start(item.competencia).isoformat(),
                "taxa_mensal": float(taxa),
                "fonte": item.fonte or "manual",
                "updated_by": str(user.id),
            }
        )
    client.table(SELIC).upsert(rows, on_conflict="competencia").execute()
    recalculados = _recalcular_todos(client)
    return {"ok": True, "count": len(rows), "recalculados": recalculados}


@selic_router.delete("/{competencia}")
def delete_selic(
    competencia: date,
    _: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
):
    client.table(SELIC).delete().eq("competencia", month_start(competencia).isoformat()).execute()
    _recalcular_todos(client)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- dashboard GET ----------


@router.get("/empresas")
def list_empresas_com_creditos(
    _: Annotated[AuthUser, Depends(require_painel_fiscal_reader)],
    client: Annotated[Client, Depends(get_db_client)],
):
    """Empresas que já têm controle de créditos cadastrado."""
    controles = fetch_all(
        lambda: client.table(CONTROLE).select("empresa_id").order("empresa_id")
    )
    ids = sorted({str(r["empresa_id"]) for r in controles if r.get("empresa_id")})
    if not ids:
        return []
    empresas = fetch_all(
        lambda: client.table("empresas")
        .select("id,razao_social,cnpj,logo_url,logo_url_escuro,ativa")
        .in_("id", ids)
        .order("razao_social")
        .order("id")
    )
    return [e for e in empresas if e.get("ativa") is not False]


@router.delete("/controle")
def delete_controle_empresa(
    _: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
    empresa_id: UUID = Query(...),
):
    """Remove o controle de créditos da empresa (cascata: cadastros, eventos, movimentos)."""
    client.table(CONTROLE).delete().eq("empresa_id", str(empresa_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("")
def get_controle(
    _: Annotated[AuthUser, Depends(require_painel_fiscal_reader)],
    client: Annotated[Client, Depends(get_db_client)],
    empresa_id: UUID = Query(...),
    competencia: date | None = None,
):
    emp = (
        client.table("empresas")
        .select("id,razao_social,cnpj,logo_url,logo_url_escuro")
        .eq("id", str(empresa_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not emp:
        raise HTTPException(404, "Empresa não encontrada")
    empresa = emp[0]

    controles = (
        client.table(CONTROLE).select("*").eq("empresa_id", str(empresa_id)).limit(1).execute().data
        or []
    )
    if not controles:
        return {
            "empresa": empresa,
            "controle": None,
            "competencia": (competencia or today_br().replace(day=1)).isoformat(),
            "consolidada": None,
            "creditos": [],
            "selic": [],
        }

    controle = controles[0]
    ref = month_start(competencia or _parse_date(controle.get("competencia_atual")) or today_br())
    cadastros = fetch_all(
        lambda: client.table(CADASTRO)
        .select("*")
        .eq("controle_id", controle["id"])
        .order("codigo_interno")
    )
    selic_map = _load_selic_map(client)
    movimentos_por_codigo: dict[int, list[MovimentoCalculado]] = {}
    creditos_out: list[dict[str, Any]] = []

    for cad in cadastros:
        mov_rows = fetch_all(
            lambda cid=str(cad["id"]): client.table(MOV)
            .select("*")
            .eq("credito_id", cid)
            .order("competencia")
        )
        # se vazio e tem início, recalcula on-the-fly (sem gravar se leitor)
        movs = [_row_to_mov(r) for r in mov_rows]
        if not movs and cad.get("data_inicio_atualizacao"):
            movs = calcular_ledger(
                credito_original_inicial=Decimal(str(cad.get("credito_original_inicial") or 0)),
                data_inicio=_parse_date(cad["data_inicio_atualizacao"]) or ref,
                data_fim=ref,
                selic_por_mes=selic_map,
                compensacoes_por_mes=agregar_compensacoes(
                    fetch_all(
                        lambda cid=str(cad["id"]): client.table(COMP)
                        .select("competencia,valor")
                        .eq("credito_id", cid)
                        .order("competencia")
                    )
                ),
            )
        codigo = int(cad["codigo_interno"])
        movimentos_por_codigo[codigo] = movs
        mov_ref = next((m for m in movs if m.competencia == ref), None)
        eventos = fetch_all(
            lambda cid=str(cad["id"]): client.table(COMP)
            .select("*")
            .eq("credito_id", cid)
            .order("competencia")
            .order("id")
        )
        creditos_out.append(
            {
                **cad,
                "status": _status_credito(mov_ref, bool(cad.get("na_consolidada"))),
                "movimento_ref": mov_ref.as_dict() if mov_ref else None,
                "movimentos": [m.as_dict() for m in movs],
                "compensacoes": eventos,
            }
        )

    consolidada = montar_consolidada(ref, cadastros, movimentos_por_codigo)
    # breakdown por tributo só dos linkados
    by_trib: dict[str, dict[str, float]] = {}
    for ln in consolidada.linhas:
        if not ln.movimento:
            continue
        t = ln.tributo or "Outros"
        bucket = by_trib.setdefault(
            t, {"original": 0.0, "compensado": 0.0, "remanescente": 0.0, "saldo": 0.0}
        )
        bucket["original"] += float(ln.movimento.credito_original)
        bucket["compensado"] += float(ln.movimento.total_compensado)
        bucket["remanescente"] += float(ln.movimento.credito_remanescente)
        bucket["saldo"] += float(ln.movimento.saldo_atualizado)

    selic_rows = [
        {"competencia": k.isoformat(), "taxa_mensal": float(v), "taxa_percentual": float(money(v * 100))}
        for k, v in sorted(selic_map.items())
        if abs((k.year - ref.year) * 12 + (k.month - ref.month)) <= 18
    ]

    return {
        "empresa": empresa,
        "controle": controle,
        "competencia": ref.isoformat(),
        "consolidada": {
            **consolidada.as_dict(),
            "por_tributo": by_trib,
            "pct_hint": "% = compensado / saldo atualizado do mês",
        },
        "creditos": creditos_out,
        "selic": selic_rows,
    }


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return month_start(value)
    return month_start(date.fromisoformat(str(value)[:10]))


def _row_to_mov(r: dict[str, Any]) -> MovimentoCalculado:
    return MovimentoCalculado(
        competencia=date.fromisoformat(str(r["competencia"])[:10]),
        selic_mensal=Decimal(str(r.get("selic_mensal") or 0)),
        selic_acumulada=Decimal(str(r.get("selic_acumulada") or 0)),
        credito_original=money(r.get("credito_original")),
        saldo_atualizado=money(r.get("saldo_atualizado")),
        principal=money(r.get("principal")),
        juros=money(r.get("juros")),
        total_compensado=money(r.get("total_compensado")),
        credito_remanescente=money(r.get("credito_remanescente")),
        credito_original_utilizado=money(r.get("credito_original_utilizado")),
        credito_original_remanescente=money(r.get("credito_original_remanescente")),
        atualiz_mes=money(r.get("atualiz_mes")),
    )


# ---------- controle / cadastros ----------


@router.patch("/controle")
def patch_controle(
    user: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
    empresa_id: UUID = Query(...),
    body: ControleUpdate = ...,
):
    controle = _ensure_controle(client, empresa_id, user)
    patch = body.model_dump(exclude_unset=True)
    if "competencia_atual" in patch and patch["competencia_atual"]:
        patch["competencia_atual"] = month_start(patch["competencia_atual"]).isoformat()
    patch["updated_by"] = str(user.id)
    updated = (
        client.table(CONTROLE).update(patch).eq("id", controle["id"]).execute().data or []
    )
    return updated[0] if updated else controle


@router.put("/cadastros")
def upsert_cadastro(
    user: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
    empresa_id: UUID = Query(...),
    body: CadastroUpsert = ...,
):
    controle = _ensure_controle(client, empresa_id, user)
    payload = body.model_dump()
    payload["controle_id"] = controle["id"]
    payload["credito_original_inicial"] = float(money(payload["credito_original_inicial"]))
    if payload.get("data_inicio_atualizacao"):
        payload["data_inicio_atualizacao"] = month_start(payload["data_inicio_atualizacao"]).isoformat()
    payload["updated_by"] = str(user.id)
    with constraint_errors(duplicate="Já existe cadastro com esse código interno"):
        result = (
            client.table(CADASTRO)
            .upsert(payload, on_conflict="controle_id,codigo_interno")
            .execute()
            .data
        )
    if not result:
        raise HTTPException(500, "Falha ao salvar cadastro")
    cad = result[0]
    selic = _load_selic_map(client)
    fim = _parse_date(controle.get("competencia_atual")) or today_br().replace(day=1)
    _recalcular_credito(client, cad, selic, fim)
    return cad


@router.delete("/cadastros/{cadastro_id}")
def delete_cadastro(
    cadastro_id: UUID,
    _: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
):
    client.table(CADASTRO).delete().eq("id", str(cadastro_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- compensações ----------


@router.post("/cadastros/{cadastro_id}/compensacoes", status_code=status.HTTP_201_CREATED)
def create_compensacao(
    cadastro_id: UUID,
    body: CompensacaoCreate,
    user: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
):
    cad = _get_cadastro(client, cadastro_id)
    row = {
        "credito_id": str(cadastro_id),
        "competencia": month_start(body.competencia).isoformat(),
        "data_compensacao": body.competencia.isoformat(),
        "valor": float(money(body.valor)),
        "multa": float(money(body.multa)),
        "juros_evento": float(money(body.juros_evento)),
        "numero_dcomp": body.numero_dcomp.strip(),
        "cod_receita": body.cod_receita.strip(),
        "debito_compensado": body.debito_compensado.strip(),
        "updated_by": str(user.id),
    }
    created = client.table(COMP).insert(row).execute().data
    if not created:
        raise HTTPException(500, "Falha ao criar compensação")
    selic = _load_selic_map(client)
    _recalcular_credito(client, cad, selic)
    return created[0]


@router.patch("/compensacoes/{evento_id}")
def patch_compensacao(
    evento_id: UUID,
    body: CompensacaoUpdate,
    user: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
):
    existing = (
        client.table(COMP).select("*").eq("id", str(evento_id)).limit(1).execute().data or []
    )
    if not existing:
        raise HTTPException(404, "Evento não encontrado")
    patch = body.model_dump(exclude_unset=True)
    if "competencia" in patch and patch["competencia"]:
        patch["data_compensacao"] = patch["competencia"].isoformat()
        patch["competencia"] = month_start(patch["competencia"]).isoformat()
    for k in ("valor", "multa", "juros_evento"):
        if k in patch and patch[k] is not None:
            patch[k] = float(money(patch[k]))
    patch["updated_by"] = str(user.id)
    updated = client.table(COMP).update(patch).eq("id", str(evento_id)).execute().data or []
    cad = _get_cadastro(client, UUID(existing[0]["credito_id"]))
    _recalcular_credito(client, cad, _load_selic_map(client))
    return updated[0] if updated else existing[0]


@router.delete("/compensacoes/{evento_id}")
def delete_compensacao(
    evento_id: UUID,
    _: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
):
    existing = (
        client.table(COMP).select("*").eq("id", str(evento_id)).limit(1).execute().data or []
    )
    if not existing:
        raise HTTPException(404, "Evento não encontrado")
    client.table(COMP).delete().eq("id", str(evento_id)).execute()
    cad = _get_cadastro(client, UUID(existing[0]["credito_id"]))
    _recalcular_credito(client, cad, _load_selic_map(client))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _get_cadastro(client: Client, cadastro_id: UUID) -> dict[str, Any]:
    rows = client.table(CADASTRO).select("*").eq("id", str(cadastro_id)).limit(1).execute().data or []
    if not rows:
        raise HTTPException(404, "Cadastro não encontrado")
    return rows[0]


@router.post("/recalcular-empresa")
def recalcular_empresa(
    user: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
    empresa_id: UUID = Query(...),
    competencia: date | None = None,
):
    controle = _ensure_controle(client, empresa_id, user)
    cads = fetch_all(
        lambda: client.table(CADASTRO).select("*").eq("controle_id", controle["id"]).order("codigo_interno")
    )
    selic = _load_selic_map(client)
    fim = month_start(competencia or _parse_date(controle.get("competencia_atual")) or today_br())
    total = 0
    for cad in cads:
        total += len(_recalcular_credito(client, cad, selic, fim))
    if competencia:
        client.table(CONTROLE).update(
            {"competencia_atual": fim.isoformat(), "updated_by": str(user.id)}
        ).eq("id", controle["id"]).execute()
    return {"ok": True, "movimentos": total}


@router.post("/{cadastro_id}/recalcular")
def recalcular(
    cadastro_id: UUID,
    _: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
    competencia: date | None = None,
):
    cad = _get_cadastro(client, cadastro_id)
    movs = _recalcular_credito(client, cad, _load_selic_map(client), competencia)
    return {"ok": True, "movimentos": len(movs)}


# ---------- import / modelo ----------


@router.get("/modelo.xlsx")
def download_modelo(_: Annotated[AuthUser, Depends(require_painel_fiscal_reader)]):
    return Response(
        content=build_modelo_xlsx(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="modelo_creditos.xlsx"'},
    )


@router.post("/import")
def import_creditos(
    user: Annotated[AuthUser, Depends(require_painel_fiscal_editor)],
    client: Annotated[Client, Depends(get_db_client)],
    empresa_id: UUID = Form(...),
    file: UploadFile = File(...),
    forcar_cnpj: bool = Form(False),
):
    name = (file.filename or "").lower()
    if not name.endswith((".xlsx", ".xlsb")):
        raise HTTPException(
            400,
            "Envie um arquivo .xlsx ou .xlsb do Controle de Créditos.",
        )
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "Arquivo excede o limite de 12 MB")
    if not content:
        raise HTTPException(400, "Arquivo vazio")

    emp = (
        client.table("empresas")
        .select("id,cnpj,razao_social")
        .eq("id", str(empresa_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not emp:
        raise HTTPException(404, "Empresa não encontrada")
    empresa = emp[0]

    try:
        parsed = parse_creditos_bytes(content, file.filename)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    emp_cnpj = so_digitos_cnpj(empresa.get("cnpj") or "")
    if parsed.cnpj and emp_cnpj and parsed.cnpj != emp_cnpj:
        if not forcar_cnpj:
            raise HTTPException(
                409,
                detail=(
                    f"CNPJ do arquivo ({parsed.cnpj}) difere da empresa ({emp_cnpj}). "
                    "Confirme a importação para forçar."
                ),
            )
        parsed.warnings.append(
            f"CNPJ divergente importado com confirmação: {parsed.cnpj} ≠ {emp_cnpj}"
        )

    return apply_import(
        client,
        empresa_id=empresa_id,
        parsed=parsed,
        user_id=str(user.id),
    )
