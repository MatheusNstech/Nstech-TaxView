from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date
from typing import Any

from app.schemas.models import CalendarioDia, CalendarioEmpresa
from app.services.status_engine import is_delivered

MAX_LOGOS_DIA = 3


def sinais_item(item: dict[str, Any]) -> tuple[bool, bool]:
    """(atrasado, reaberta) com as mesmas regras do Kanban."""
    status = item.get("status")
    if is_delivered(status):
        return False, False
    atrasado = status == "ATRASADO" or item.get("urgencia") == "atrasado"
    return atrasado, bool(item.get("entrega_original"))


def _chave_empresa(empresa: dict[str, Any]) -> str:
    # Unidades do mesmo grupo dividem o logo: contam como uma empresa só.
    return empresa.get("logo_url") or str(empresa.get("id"))


def resumo_dia(
    dia: date,
    obrigacoes: list[dict[str, Any]],
    tarefas: list[dict[str, Any]],
) -> CalendarioDia:
    por_status: dict[str, int] = defaultdict(int)
    atrasadas = reabertas = 0
    contagem: Counter[str] = Counter()
    empresa_por_chave: dict[str, dict[str, Any]] = {}

    for item in [*obrigacoes, *tarefas]:
        por_status[item.get("status") or "PENDENTE"] += 1
        atrasado, reaberta = sinais_item(item)
        atrasadas += atrasado
        reabertas += reaberta
        empresa = item.get("empresa")
        if empresa and empresa.get("id"):
            chave = _chave_empresa(empresa)
            contagem[chave] += 1
            empresa_por_chave.setdefault(chave, empresa)

    def nome(emp: dict[str, Any]) -> str:
        return (emp.get("nome_fantasia") or emp.get("razao_social") or "").strip()

    ordem = sorted(contagem, key=lambda c: (-contagem[c], nome(empresa_por_chave[c]).lower()))
    empresas = [
        CalendarioEmpresa(
            id=empresa_por_chave[c]["id"],
            nome=nome(empresa_por_chave[c]),
            logo_url=empresa_por_chave[c].get("logo_url"),
            logo_url_escuro=empresa_por_chave[c].get("logo_url_escuro"),
            bu=empresa_por_chave[c].get("bu"),
        )
        for c in ordem[:MAX_LOGOS_DIA]
    ]

    return CalendarioDia(
        data=dia,
        total=len(obrigacoes) + len(tarefas),
        atrasadas=atrasadas,
        por_status=dict(por_status),
        reabertas=reabertas,
        tarefas=len(tarefas),
        empresas=empresas,
        mais_empresas=max(0, len(ordem) - MAX_LOGOS_DIA),
    )
