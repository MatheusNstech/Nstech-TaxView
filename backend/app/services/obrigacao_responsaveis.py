"""Responsáveis de uma obrigação: principal (obrigacoes.responsavel_id) + co-responsáveis.

A tabela obrigacao_responsaveis guarda o conjunto completo; o trigger do banco mantém o
principal sempre presente nela.
"""
from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from supabase import Client

from app.services.db import fetch_all

RESPONSAVEIS_EMBED = "obrigacao_responsaveis(responsavel_id,responsaveis(*))"
_FILTER_ALIAS = "filtro_resp"


def _ids(responsavel_id: str | list[str] | None) -> list[str]:
    if not responsavel_id:
        return []
    if isinstance(responsavel_id, str):
        return [responsavel_id]
    return [str(r) for r in responsavel_id]


def select_with_responsavel_filter(
    columns: str, responsavel_id: str | list[str] | None
) -> str:
    """Acrescenta um inner join na tabela de vínculo quando há filtro por responsável.

    Use junto com `apply_responsavel_filter`; o embed com alias não altera a lista de
    responsáveis devolvida em `obrigacao_responsaveis`.
    """
    if not _ids(responsavel_id):
        return columns
    return f"{columns},{_FILTER_ALIAS}:obrigacao_responsaveis!inner(responsavel_id)"


def apply_responsavel_filter(query: Any, responsavel_id: str | list[str] | None) -> Any:
    ids = _ids(responsavel_id)
    if not ids:
        return query
    if len(ids) == 1:
        return query.eq(f"{_FILTER_ALIAS}.responsavel_id", ids[0])
    return query.in_(f"{_FILTER_ALIAS}.responsavel_id", ids)


def pop_responsaveis(row: dict[str, Any], principal: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Remove os embeds de vínculo da linha e devolve a lista: principal primeiro, depois por nome."""
    row.pop(_FILTER_ALIAS, None)
    links = row.pop("obrigacao_responsaveis", None) or []
    principal_id = str(row.get("responsavel_id") or "")
    out: dict[str, dict[str, Any]] = {}
    if principal and principal.get("id"):
        out[str(principal["id"])] = principal
    for link in links:
        resp = link.get("responsaveis") or {}
        rid = str(resp.get("id") or link.get("responsavel_id") or "")
        if rid and rid not in out and resp:
            out[rid] = resp
    others = sorted(
        (r for rid, r in out.items() if rid != principal_id),
        key=lambda r: str(r.get("nome") or "").lower(),
    )
    head = [out[principal_id]] if principal_id in out else []
    return head + others


def responsavel_ids_of(client: Client, obrigacao_id: str) -> set[str]:
    rows = (
        client.table("obrigacao_responsaveis")
        .select("responsavel_id")
        .eq("obrigacao_id", obrigacao_id)
        .execute()
        .data
        or []
    )
    return {str(r["responsavel_id"]) for r in rows if r.get("responsavel_id")}


def links_by_obrigacao(client: Client, obrigacao_ids: Iterable[str]) -> dict[str, set[str]]:
    ids = sorted({str(i) for i in obrigacao_ids if i})
    out: dict[str, set[str]] = {}
    chunk_size = 100
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i : i + chunk_size]
        rows = fetch_all(
            lambda chunk=chunk: client.table("obrigacao_responsaveis")
            .select("obrigacao_id,responsavel_id")
            .in_("obrigacao_id", chunk)
            .order("id")
        )
        for r in rows:
            out.setdefault(str(r["obrigacao_id"]), set()).add(str(r["responsavel_id"]))
    return out


def set_responsaveis(
    client: Client,
    obrigacao_id: str,
    responsavel_ids: Iterable[str],
    principal_id: str | None,
) -> tuple[set[str], set[str]]:
    """Substitui o conjunto de responsáveis. Devolve (adicionados, removidos).

    O principal nunca é removido aqui: ele sai do vínculo só quando obrigacoes.responsavel_id muda.
    """
    desired = {str(r) for r in responsavel_ids if r}
    if principal_id:
        desired.add(str(principal_id))
    current = responsavel_ids_of(client, obrigacao_id)
    to_add = desired - current
    to_remove = current - desired
    if to_remove:
        (
            client.table("obrigacao_responsaveis")
            .delete()
            .eq("obrigacao_id", obrigacao_id)
            .in_("responsavel_id", sorted(to_remove))
            .execute()
        )
    if to_add:
        client.table("obrigacao_responsaveis").upsert(
            [{"obrigacao_id": obrigacao_id, "responsavel_id": rid} for rid in sorted(to_add)],
            on_conflict="obrigacao_id,responsavel_id",
            ignore_duplicates=True,
        ).execute()
    return to_add, to_remove


def add_responsaveis_bulk(client: Client, links: Iterable[tuple[str, str]]) -> int:
    payload = [
        {"obrigacao_id": str(oid), "responsavel_id": str(rid)}
        for oid, rid in {(str(o), str(r)) for o, r in links if o and r}
    ]
    chunk_size = 200
    for i in range(0, len(payload), chunk_size):
        client.table("obrigacao_responsaveis").upsert(
            payload[i : i + chunk_size],
            on_conflict="obrigacao_id,responsavel_id",
            ignore_duplicates=True,
        ).execute()
    return len(payload)
