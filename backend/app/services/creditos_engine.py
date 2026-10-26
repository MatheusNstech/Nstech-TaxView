"""Motor de cálculo do Controle de Créditos — espelha as fórmulas da planilha GBM."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable, Mapping

TWO = Decimal("0.01")
HUNDRED = Decimal("100")


def money(value: Decimal | float | int | str | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value)).quantize(TWO, rounding=ROUND_HALF_UP)


def pct4(value: Decimal | float | int | str | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def month_start(d: date) -> date:
    return date(d.year, d.month, 1)


def add_months(d: date, n: int) -> date:
    y = d.year + (d.month - 1 + n) // 12
    m = (d.month - 1 + n) % 12 + 1
    return date(y, m, 1)


def months_between(start: date, end: date) -> list[date]:
    """Lista competências (dia 1) de start até end inclusive."""
    cur = month_start(start)
    last = month_start(end)
    out: list[date] = []
    while cur <= last:
        out.append(cur)
        cur = add_months(cur, 1)
    return out


@dataclass(frozen=True)
class MovimentoCalculado:
    competencia: date
    selic_mensal: Decimal  # % (ex. 1.16)
    selic_acumulada: Decimal  # índice K (ex. 7.65)
    credito_original: Decimal
    saldo_atualizado: Decimal
    principal: Decimal
    juros: Decimal
    total_compensado: Decimal
    credito_remanescente: Decimal
    credito_original_utilizado: Decimal
    credito_original_remanescente: Decimal
    atualiz_mes: Decimal

    def as_dict(self) -> dict[str, object]:
        return {
            "competencia": self.competencia.isoformat(),
            "selic_mensal": float(self.selic_mensal),
            "selic_acumulada": float(self.selic_acumulada),
            "credito_original": float(self.credito_original),
            "saldo_atualizado": float(self.saldo_atualizado),
            "principal": float(self.principal),
            "juros": float(self.juros),
            "total_compensado": float(self.total_compensado),
            "credito_remanescente": float(self.credito_remanescente),
            "credito_original_utilizado": float(self.credito_original_utilizado),
            "credito_original_remanescente": float(self.credito_original_remanescente),
            "atualiz_mes": float(self.atualiz_mes),
        }


def taxa_percentual(
    competencia: date,
    selic_por_mes: Mapping[date, Decimal | float],
) -> Decimal:
    """Converte fração da tabela (0.01) ou % já normalizado em % ao mês."""
    raw = selic_por_mes.get(month_start(competencia))
    if raw is None:
        return Decimal("0")
    d = Decimal(str(raw))
    # Fração típica da aba SELIC: 0 < x < 1 → *100. Valores >= 1 já são %.
    if Decimal("0") < d < Decimal("1"):
        return pct4(d * HUNDRED)
    return pct4(d)


def calcular_ledger(
    *,
    credito_original_inicial: Decimal | float,
    data_inicio: date,
    data_fim: date,
    selic_por_mes: Mapping[date, Decimal | float],
    compensacoes_por_mes: Mapping[date, Decimal | float] | None = None,
) -> list[MovimentoCalculado]:
    """Recalcula o ledger mensal de um crédito (abas 1–4)."""
    comps = compensacoes_por_mes or {}
    inicio = month_start(data_inicio)
    fim = month_start(data_fim)
    competencias = months_between(inicio, fim)
    if not competencias:
        return []

    rows: list[MovimentoCalculado] = []
    original = money(credito_original_inicial)
    remanescente_ant = money(0)
    taxas: list[Decimal] = []

    for i, comp in enumerate(competencias):
        h = taxa_percentual(comp, selic_por_mes)
        if i == 0:
            k = Decimal("1")
        else:
            k = pct4(Decimal("1") + sum(taxas, Decimal("0")))
        taxas.append(h)

        if i > 0:
            original = rows[i - 1].credito_original_remanescente

        if h == 0:
            saldo = money(0)
        else:
            saldo = money(original * (Decimal("1") + k / HUNDRED))

        total_comp = money(comps.get(comp, 0))
        if total_comp and k != 0:
            principal = money(total_comp / (Decimal("1") + k / HUNDRED))
        else:
            principal = money(0)
        juros = money(total_comp - principal)
        remanescente = money(saldo - total_comp)

        if saldo != 0:
            original_util = money(original * total_comp / saldo)
        else:
            original_util = money(0)
        original_rem = money(original - original_util)

        if h == 0:
            atualiz = money(0)
        elif i == 0:
            atualiz = money(saldo - original)
        else:
            atualiz = money(saldo - remanescente_ant)

        mov = MovimentoCalculado(
            competencia=comp,
            selic_mensal=h,
            selic_acumulada=k,
            credito_original=original,
            saldo_atualizado=saldo,
            principal=principal,
            juros=juros,
            total_compensado=total_comp,
            credito_remanescente=remanescente,
            credito_original_utilizado=original_util,
            credito_original_remanescente=original_rem,
            atualiz_mes=atualiz,
        )
        rows.append(mov)
        remanescente_ant = remanescente

    return rows


@dataclass(frozen=True)
class LinhaConsolidada:
    codigo_interno: int
    tipo_credito: str
    tributo: str
    ano_calendario: int | None
    movimento: MovimentoCalculado | None


@dataclass(frozen=True)
class Consolidada:
    competencia: date
    linhas: list[LinhaConsolidada]
    total_compensado: Decimal
    credito_remanescente: Decimal
    selic_mes: Decimal
    credito_original: Decimal
    saldo_atualizado: Decimal
    percentual_utilizado: Decimal | None

    def as_dict(self) -> dict[str, object]:
        return {
            "competencia": self.competencia.isoformat(),
            "total_compensado": float(self.total_compensado),
            "credito_remanescente": float(self.credito_remanescente),
            "selic_mes": float(self.selic_mes),
            "credito_original": float(self.credito_original),
            "saldo_atualizado": float(self.saldo_atualizado),
            "percentual_utilizado": (
                float(self.percentual_utilizado) if self.percentual_utilizado is not None else None
            ),
            "linhas": [
                {
                    "codigo_interno": ln.codigo_interno,
                    "tipo_credito": ln.tipo_credito,
                    "tributo": ln.tributo,
                    "ano_calendario": ln.ano_calendario,
                    "movimento": ln.movimento.as_dict() if ln.movimento else None,
                }
                for ln in self.linhas
            ],
        }


def montar_consolidada(
    competencia: date,
    cadastros: Iterable[Mapping[str, object]],
    movimentos_por_codigo: Mapping[int, Iterable[MovimentoCalculado]],
) -> Consolidada:
    """Soma só créditos com na_consolidada=true no mês de referência."""
    ref = month_start(competencia)
    linhas: list[LinhaConsolidada] = []
    tot_comp = money(0)
    tot_rem = money(0)
    tot_selic = money(0)
    tot_orig = money(0)
    tot_saldo = money(0)

    for cad in sorted(cadastros, key=lambda c: int(c.get("codigo_interno") or 0)):
        if not cad.get("na_consolidada"):
            continue
        codigo = int(cad["codigo_interno"])
        movs = list(movimentos_por_codigo.get(codigo, []))
        mov = next((m for m in movs if m.competencia == ref), None)
        linhas.append(
            LinhaConsolidada(
                codigo_interno=codigo,
                tipo_credito=str(cad.get("tipo_credito") or ""),
                tributo=str(cad.get("tributo") or ""),
                ano_calendario=int(cad["ano_calendario"]) if cad.get("ano_calendario") else None,
                movimento=mov,
            )
        )
        if mov:
            tot_comp += mov.total_compensado
            tot_rem += mov.credito_remanescente
            tot_selic += mov.atualiz_mes
            tot_orig += mov.credito_original
            tot_saldo += mov.saldo_atualizado

    pct: Decimal | None
    if tot_saldo != 0:
        pct = money(tot_comp * HUNDRED / tot_saldo)
    else:
        pct = None

    return Consolidada(
        competencia=ref,
        linhas=linhas,
        total_compensado=money(tot_comp),
        credito_remanescente=money(tot_rem),
        selic_mes=money(tot_selic),
        credito_original=money(tot_orig),
        saldo_atualizado=money(tot_saldo),
        percentual_utilizado=pct,
    )


def agregar_compensacoes(
    eventos: Iterable[Mapping[str, object]],
) -> dict[date, Decimal]:
    """Soma valor (col V) por competência — espelha SUMIF da planilha."""
    out: dict[date, Decimal] = {}
    for ev in eventos:
        comp = ev.get("competencia")
        if isinstance(comp, str):
            comp_d = date.fromisoformat(comp[:10])
        elif isinstance(comp, date):
            comp_d = month_start(comp)
        else:
            continue
        comp_d = month_start(comp_d)
        out[comp_d] = money(out.get(comp_d, 0) + money(ev.get("valor")))
    return out
