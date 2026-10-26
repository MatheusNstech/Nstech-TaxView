"""Persiste ImportParsed no Supabase (API + seed)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from supabase import Client

from app.core.clock import today_br
from app.services.creditos_engine import (
    MovimentoCalculado,
    agregar_compensacoes,
    calcular_ledger,
    month_start,
)
from app.services.creditos_import import ImportParsed
from app.services.db import fetch_all

CONTROLE = "credito_controles"
CADASTRO = "credito_cadastros"
COMP = "credito_compensacoes"
MOV = "credito_movimentos"
SELIC = "selic_taxas"


def load_selic_map(client: Client) -> dict[date, Decimal]:
    rows = fetch_all(
        lambda: client.table(SELIC).select("competencia,taxa_mensal").order("competencia")
    )
    out: dict[date, Decimal] = {}
    for r in rows:
        comp = date.fromisoformat(str(r["competencia"])[:10])
        out[month_start(comp)] = Decimal(str(r["taxa_mensal"]))
    return out


def ensure_controle(
    client: Client,
    empresa_id: str | UUID,
    user_id: str | None = None,
) -> dict[str, Any]:
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
    payload: dict[str, Any] = {
        "empresa_id": str(empresa_id),
        "conta_contabil": "113359",
        "descricao_conta": "Saldo Negativo de Anos Anteriores",
    }
    if user_id:
        payload["updated_by"] = user_id
    created = client.table(CONTROLE).insert(payload).execute().data
    if not created:
        raise RuntimeError("Falha ao criar controle de créditos")
    return created[0]


def persist_movimentos(
    client: Client,
    credito_id: str,
    movimentos: list[MovimentoCalculado],
) -> None:
    client.table(MOV).delete().eq("credito_id", credito_id).execute()
    if not movimentos:
        return
    rows = [
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
        for m in movimentos
    ]
    for i in range(0, len(rows), 200):
        client.table(MOV).insert(rows[i : i + 200]).execute()


def recalcular_credito(
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
    inicio_d = (
        date.fromisoformat(inicio[:10]) if isinstance(inicio, str) else month_start(inicio)
    )
    fim = competencia_fim or today_br().replace(day=1)
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
    persist_movimentos(client, credito_id, movimentos)
    return movimentos


def apply_import(
    client: Client,
    *,
    empresa_id: str | UUID,
    parsed: ImportParsed,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Grava controle + cadastros + eventos + SELIC + recalcula. Não valida CNPJ."""
    warnings = list(parsed.warnings)
    controle = ensure_controle(client, empresa_id, user_id)
    conta_antiga = (controle.get("conta_contabil") or "").strip()
    if parsed.conta_contabil and conta_antiga and parsed.conta_contabil != conta_antiga:
        warnings.append(
            f"Conta contábil do arquivo ({parsed.conta_contabil}) ≠ cadastro ({conta_antiga})"
        )

    patch_ctrl: dict[str, Any] = {}
    if user_id:
        patch_ctrl["updated_by"] = user_id
    if parsed.conta_contabil:
        patch_ctrl["conta_contabil"] = parsed.conta_contabil
    if parsed.descricao_conta:
        patch_ctrl["descricao_conta"] = parsed.descricao_conta
    if parsed.competencia_ref:
        patch_ctrl["competencia_atual"] = parsed.competencia_ref.isoformat()
    if patch_ctrl:
        client.table(CONTROLE).update(patch_ctrl).eq("id", controle["id"]).execute()
        controle = {**controle, **patch_ctrl}

    if parsed.selic:
        selic_rows = [
            {
                "competencia": comp.isoformat(),
                "taxa_mensal": float(taxa),
                "fonte": "import",
                **({"updated_by": user_id} if user_id else {}),
            }
            for comp, taxa in parsed.selic.items()
        ]
        for i in range(0, len(selic_rows), 200):
            client.table(SELIC).upsert(selic_rows[i : i + 200], on_conflict="competencia").execute()

    selic_map = load_selic_map(client)
    diffs: list[dict[str, Any]] = []
    imported = 0
    fim = parsed.competencia_ref or today_br().replace(day=1)

    for cred in parsed.creditos:
        payload: dict[str, Any] = {
            "controle_id": controle["id"],
            "codigo_interno": cred.codigo_interno,
            "tipo_credito": cred.tipo_credito,
            "tributo": cred.tributo,
            "ano_calendario": cred.ano_calendario,
            "credito_original_inicial": float(cred.credito_original_inicial),
            "data_inicio_atualizacao": (
                cred.data_inicio_atualizacao.isoformat() if cred.data_inicio_atualizacao else None
            ),
            "na_consolidada": cred.codigo_interno in parsed.na_consolidada,
            "ativo": True,
            "observacao": cred.observacao,
        }
        if user_id:
            payload["updated_by"] = user_id
        result = (
            client.table(CADASTRO)
            .upsert(payload, on_conflict="controle_id,codigo_interno")
            .execute()
            .data
        )
        if not result:
            warnings.append(f"Falha ao gravar crédito {cred.codigo_interno}")
            continue
        cad = result[0]
        client.table(COMP).delete().eq("credito_id", cad["id"]).execute()
        if cred.eventos:
            ev_rows = [
                {
                    "credito_id": cad["id"],
                    "competencia": e["competencia"],
                    "valor": e["valor"],
                    "multa": e.get("multa") or 0,
                    "juros_evento": e.get("juros_evento") or 0,
                    "data_compensacao": e.get("data_compensacao") or e["competencia"],
                    "numero_dcomp": e.get("numero_dcomp") or "",
                    "cod_receita": e.get("cod_receita") or "",
                    "debito_compensado": e.get("debito_compensado") or "",
                    **({"updated_by": user_id} if user_id else {}),
                }
                for e in cred.eventos
            ]
            for i in range(0, len(ev_rows), 200):
                client.table(COMP).insert(ev_rows[i : i + 200]).execute()

        movs = recalcular_credito(client, cad, selic_map, fim)
        imported += 1

        mov_ref = next((m for m in movs if m.competencia == fim), None)
        if mov_ref and cred.excel_remanescente is not None:
            delta = abs(mov_ref.credito_remanescente - cred.excel_remanescente)
            if delta > Decimal("0.01"):
                diffs.append(
                    {
                        "codigo": cred.codigo_interno,
                        "campo": "credito_remanescente",
                        "engine": float(mov_ref.credito_remanescente),
                        "excel": float(cred.excel_remanescente),
                        "delta": float(delta),
                    }
                )
                warnings.append(
                    f"Crédito {cred.codigo_interno}: remanescente engine "
                    f"{mov_ref.credito_remanescente} ≠ excel {cred.excel_remanescente}"
                )
        if mov_ref and cred.excel_saldo_jul is not None:
            delta = abs(mov_ref.saldo_atualizado - cred.excel_saldo_jul)
            if delta > Decimal("0.01"):
                diffs.append(
                    {
                        "codigo": cred.codigo_interno,
                        "campo": "saldo_atualizado",
                        "engine": float(mov_ref.saldo_atualizado),
                        "excel": float(cred.excel_saldo_jul),
                        "delta": float(delta),
                    }
                )

    return {
        "ok": True,
        "imported": imported,
        "selic": len(parsed.selic),
        "na_consolidada": sorted(parsed.na_consolidada),
        "conta_contabil": parsed.conta_contabil,
        "warnings": warnings,
        "diffs": diffs,
        "cnpj_arquivo": parsed.cnpj,
        "controle_id": controle["id"],
    }
