"""Tela Empresas: agrupa CNPJs pela raiz (matriz + filiais) com contatos e números do mês."""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import date
from typing import Any

from app.services.obrigacao_responsaveis import pop_responsaveis
from app.services.status_engine import as_br_date, is_delivered, normalize_status, urgencia_label

AREAS = ("contabil", "contas_pagar")


def cnpj_digits(cnpj: str | None) -> str:
    return re.sub(r"\D", "", cnpj or "")


def cnpj_raiz(empresa: dict[str, Any]) -> str:
    digits = cnpj_digits(empresa.get("cnpj"))
    # CNPJ estrangeiro/incompleto não agrupa com ninguém.
    return digits[:8] if len(digits) == 14 else f"id:{empresa['id']}"


def _is_matriz(empresa: dict[str, Any]) -> bool:
    return cnpj_digits(empresa.get("cnpj"))[8:12] == "0001"


def _contatos_por_area(contatos: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {area: [] for area in AREAS}
    for c in sorted(contatos, key=lambda c: (c.get("ordem") or 0, c.get("nome") or "", c.get("email") or "")):
        if c.get("area") in out:
            out[c["area"]].append(c)
    return out


def _assinatura(contatos: list[dict[str, Any]]) -> list[tuple[str, str]]:
    return [((c.get("nome") or "").strip().lower(), (c.get("email") or "").strip().lower()) for c in contatos]


def _resumo_obrigacao(row: dict[str, Any], today: date) -> tuple[bool, bool]:
    """(entregue, atrasada) com as mesmas regras dos painéis."""
    prazo_legal = date.fromisoformat(row["prazo_legal"]) if row.get("prazo_legal") else None
    prazo_fiscal = date.fromisoformat(row["prazo_fiscal"]) if row.get("prazo_fiscal") else None
    entrega_original = as_br_date(row.get("entrega_original"))
    st = normalize_status(
        row.get("status") or "PENDENTE",
        prazo_legal,
        prazo_fiscal,
        date.fromisoformat(row["data_entrega"]) if row.get("data_entrega") else None,
        today=today,
        entrega_original=entrega_original,
    )
    if is_delivered(st):
        return True, False
    atrasada = st == "ATRASADO" or (
        urgencia_label(st, prazo_legal, prazo_fiscal, today=today, entrega_original=entrega_original)
        == "atrasado"
    )
    return False, atrasada


def montar_grupos(
    empresas: list[dict[str, Any]],
    contatos: list[dict[str, Any]],
    obrigacoes: list[dict[str, Any]],
    today: date,
) -> list[dict[str, Any]]:
    contatos_emp: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for c in contatos:
        contatos_emp[str(c["empresa_id"])].append(c)

    obr_emp: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for o in obrigacoes:
        obr_emp[str(o.get("empresa_id"))].append(o)

    grupos: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for e in empresas:
        grupos[cnpj_raiz(e)].append(e)

    out: list[dict[str, Any]] = []
    for raiz, membros in grupos.items():
        membros.sort(key=lambda e: (not _is_matriz(e), cnpj_digits(e.get("cnpj")), e.get("razao_social") or ""))
        matriz = membros[0]

        proprios = {str(e["id"]): _contatos_por_area(contatos_emp.get(str(e["id"]), [])) for e in membros}
        contatos_grupo: dict[str, list[dict[str, Any]]] = {}
        for area in AREAS:
            contatos_grupo[area] = next(
                (proprios[str(e["id"])][area] for e in membros if proprios[str(e["id"])][area]),
                [],
            )

        def _unidade(e: dict[str, Any]) -> dict[str, Any]:
            own = proprios[str(e["id"])]
            return {
                "id": e["id"],
                "cnpj": e.get("cnpj") or "",
                "razao_social": e.get("razao_social") or "",
                "nome_fantasia": e.get("nome_fantasia"),
                "bu": e.get("bu") or "",
                "porte": e.get("porte"),
                "ativa": bool(e.get("ativa", True)),
                "matriz": _is_matriz(e),
                "contatos": [c for area in AREAS for c in own[area]],
                "contatos_diferentes": any(
                    own[area] and _assinatura(own[area]) != _assinatura(contatos_grupo[area])
                    for area in AREAS
                ),
            }

        total = entregues = atrasadas = 0
        fiscais: Counter[str] = Counter()
        nomes: dict[str, str] = {}
        for e in membros:
            for row in obr_emp.get(str(e["id"]), []):
                row = dict(row)
                total += 1
                entregue, atrasada = _resumo_obrigacao(row, today)
                entregues += entregue
                atrasadas += atrasada
                for resp in pop_responsaveis(row, row.pop("responsaveis", None)):
                    rid = str(resp.get("id") or "")
                    if rid:
                        fiscais[rid] += 1
                        nomes[rid] = resp.get("nome") or ""

        bus = [matriz.get("bu") or ""]
        bus += sorted({e.get("bu") or "" for e in membros} - set(bus))
        nome = matriz.get("nome_fantasia") or next(
            (e["nome_fantasia"] for e in membros if e.get("nome_fantasia")), None
        ) or matriz.get("razao_social") or ""

        out.append(
            {
                "raiz": raiz,
                "nome": nome,
                "porte": matriz.get("porte") or next((e["porte"] for e in membros if e.get("porte")), None),
                "logo_url": next((e["logo_url"] for e in membros if e.get("logo_url")), None),
                "bus": [b for b in bus if b],
                "matriz": _unidade(matriz),
                "filiais": [_unidade(e) for e in membros[1:]],
                "contatos": contatos_grupo,
                "responsaveis_fiscais": [
                    {"id": rid, "nome": nomes[rid], "total": n}
                    for rid, n in sorted(fiscais.items(), key=lambda kv: (-kv[1], nomes[kv[0]].lower()))
                ],
                "obrigacoes_total": total,
                "obrigacoes_entregues": entregues,
                "obrigacoes_atrasadas": atrasadas,
            }
        )

    out.sort(key=lambda g: g["nome"].lower())
    return out
