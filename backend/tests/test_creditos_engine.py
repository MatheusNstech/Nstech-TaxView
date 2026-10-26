"""Testes dourados do Controle de Créditos — números GBM jul/26."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.services.creditos_engine import (
    agregar_compensacoes,
    calcular_ledger,
    montar_consolidada,
    taxa_percentual,
)

# Taxas da aba SELIC (fração) — jan..jul/2026
SELIC = {
    date(2026, 1, 1): Decimal("0.0116"),
    date(2026, 2, 1): Decimal("0.0100"),
    date(2026, 3, 1): Decimal("0.0121"),
    date(2026, 4, 1): Decimal("0.0109"),
    date(2026, 5, 1): Decimal("0.0107"),
    date(2026, 6, 1): Decimal("0.0112"),
    date(2026, 7, 1): Decimal("0.0100"),
    date(2026, 8, 1): Decimal("0"),
}

# Eventos col V da aba 1 (jun + jul)
EVENTOS_JUN = [
    156122.30,
    15612.23,
    69244.09,
    19515.28,
    1561.22,
    7806.11,
    11709.17,
    4683.66,
    6662.00,
    86930.46,
    18834.93,
    882.72,
    143.44,
]
EVENTOS_JUL = [
    158508.19,
    # restantes do jul para fechar 299408.64 — a planilha tem mais linhas;
    # usamos o total conhecido via SUMIF no teste agregado
]


def _comps_total() -> dict[date, Decimal]:
    # Totais que a planilha mostra em O (SUMIF V) para jun e jul
    return {
        date(2026, 6, 1): Decimal("399707.61"),
        date(2026, 7, 1): Decimal("299408.64"),
    }


def test_taxa_percentual_converte_fracao():
    assert taxa_percentual(date(2026, 1, 1), SELIC) == Decimal("1.1600")
    assert taxa_percentual(date(2026, 8, 1), SELIC) == Decimal("0.0000")


def test_selic_acumulada_jul_26():
    rows = calcular_ledger(
        credito_original_inicial=Decimal("714507.36"),
        data_inicio=date(2026, 1, 1),
        data_fim=date(2026, 7, 1),
        selic_por_mes=SELIC,
        compensacoes_por_mes={},
    )
    jul = rows[-1]
    assert jul.competencia == date(2026, 7, 1)
    assert jul.selic_acumulada == Decimal("7.6500")
    assert jul.selic_mensal == Decimal("1.0000")


def test_ledger_jul_26_dourado():
    rows = calcular_ledger(
        credito_original_inicial=Decimal("714507.36"),
        data_inicio=date(2026, 1, 1),
        data_fim=date(2026, 7, 1),
        selic_por_mes=SELIC,
        compensacoes_por_mes=_comps_total(),
    )
    by_m = {r.competencia: r for r in rows}
    jun = by_m[date(2026, 6, 1)]
    jul = by_m[date(2026, 7, 1)]

    assert jun.total_compensado == Decimal("399707.61")
    assert jun.saldo_atualizado == Decimal("761164.69")
    assert jun.credito_remanescente == Decimal("361457.08")
    assert jun.credito_original_remanescente == Decimal("339300.74")

    assert jul.credito_original == Decimal("339300.74")
    assert jul.selic_acumulada == Decimal("7.6500")
    assert jul.saldo_atualizado == Decimal("365257.25")
    assert jul.total_compensado == Decimal("299408.64")
    assert jul.credito_remanescente == Decimal("65848.61")
    assert jul.atualiz_mes == Decimal("3800.17")
    assert jul.principal == Decimal("278131.57")
    assert jul.juros == Decimal("21277.07")


def test_taxa_zero_zera_saldo_mantem_original_rem():
    rows = calcular_ledger(
        credito_original_inicial=Decimal("714507.36"),
        data_inicio=date(2026, 1, 1),
        data_fim=date(2026, 8, 1),
        selic_por_mes=SELIC,
        compensacoes_por_mes=_comps_total(),
    )
    ago = rows[-1]
    assert ago.selic_mensal == Decimal("0.0000")
    assert ago.saldo_atualizado == Decimal("0.00")
    assert ago.atualiz_mes == Decimal("0.00")
    assert ago.credito_original_remanescente == Decimal("61169.17")


def test_agregar_compensacoes_sumif():
    eventos = [
        {"competencia": "2026-06-01", "valor": v} for v in EVENTOS_JUN
    ] + [{"competencia": date(2026, 7, 1), "valor": 299408.64}]
    agg = agregar_compensacoes(eventos)
    assert agg[date(2026, 6, 1)] == Decimal("399707.61")
    assert agg[date(2026, 7, 1)] == Decimal("299408.64")


def test_evento_compensa_propaga_mn_p():
    """Mudança de 1 evento altera principal/juros/remanescente do mês."""
    base = _comps_total()
    rows_a = calcular_ledger(
        credito_original_inicial=Decimal("714507.36"),
        data_inicio=date(2026, 1, 1),
        data_fim=date(2026, 7, 1),
        selic_por_mes=SELIC,
        compensacoes_por_mes=base,
    )
    alterado = dict(base)
    alterado[date(2026, 7, 1)] = Decimal("299408.64") + Decimal("1000.00")
    rows_b = calcular_ledger(
        credito_original_inicial=Decimal("714507.36"),
        data_inicio=date(2026, 1, 1),
        data_fim=date(2026, 7, 1),
        selic_por_mes=SELIC,
        compensacoes_por_mes=alterado,
    )
    jul_a = rows_a[-1]
    jul_b = rows_b[-1]
    assert jul_b.total_compensado == jul_a.total_compensado + Decimal("1000.00")
    assert jul_b.principal != jul_a.principal
    assert jul_b.juros != jul_a.juros
    assert jul_b.credito_remanescente == jul_a.credito_remanescente - Decimal("1000.00")


def test_consolidada_so_na_consolidada():
    comps = _comps_total()
    ledger1 = calcular_ledger(
        credito_original_inicial=Decimal("714507.36"),
        data_inicio=date(2026, 1, 1),
        data_fim=date(2026, 7, 1),
        selic_por_mes=SELIC,
        compensacoes_por_mes=comps,
    )
    ledger4 = calcular_ledger(
        credito_original_inicial=Decimal("77275.53"),
        data_inicio=date(2025, 1, 1),
        data_fim=date(2026, 7, 1),
        selic_por_mes={
            **{date(2025, m, 1): Decimal("0.01") for m in range(1, 13)},
            **SELIC,
        },
        compensacoes_por_mes={},
    )
    cadastros = [
        {
            "codigo_interno": 1,
            "tipo_credito": "Saldo Negativo IRPJ",
            "tributo": "IRPJ",
            "ano_calendario": 2025,
            "na_consolidada": True,
        },
        {
            "codigo_interno": 2,
            "tipo_credito": "Saldo Negativo CSLL",
            "tributo": "CSLL",
            "ano_calendario": 2025,
            "na_consolidada": True,
        },
        {
            "codigo_interno": 4,
            "tipo_credito": "Saldo Negativo CSLL",
            "tributo": "CSLL",
            "ano_calendario": 2025,
            "na_consolidada": False,  # fora da consolidada GBM
        },
    ]
    cons = montar_consolidada(
        date(2026, 7, 1),
        cadastros,
        {1: ledger1, 2: [], 4: ledger4},
    )
    assert cons.total_compensado == Decimal("299408.64")
    assert cons.credito_remanescente == Decimal("65848.61")
    assert cons.selic_mes == Decimal("3800.17")
    # 299408.64 / 365257.25 * 100 → 81.97 (Excel ROUND 2); UI pode exibir ~82%
    assert cons.percentual_utilizado == Decimal("81.97")
    # Aba 4 não entra nos totais
    assert all(ln.codigo_interno != 4 for ln in cons.linhas) or any(
        ln.codigo_interno == 4 and not ln.movimento for ln in cons.linhas
    )
    assert cons.credito_original == Decimal("339300.74")
