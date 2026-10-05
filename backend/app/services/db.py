from __future__ import annotations

from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from typing import Any, Callable

from fastapi import HTTPException, status
from postgrest.exceptions import APIError

# PostgREST corta respostas em max_rows (1000 no Supabase) sem sinalizar erro.
PAGE_SIZE = 1000

PG_UNIQUE_VIOLATION = "23505"
PG_FOREIGN_KEY_VIOLATION = "23503"


def fetch_all(
    build_query: Callable[[], Any],
    page_size: int = PAGE_SIZE,
    max_rows: int | None = None,
) -> list[dict[str, Any]]:
    """Busca todas as linhas (ou até `max_rows`) paginando com .range().

    `build_query` deve devolver um builder novo a cada chamada (o .range() do
    postgrest acumula parâmetros no builder) e com ordenação estável.
    """
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        size = page_size if max_rows is None else min(page_size, max_rows - len(rows))
        page = build_query().range(start, start + size - 1).execute().data or []
        rows.extend(page)
        if len(page) < size or (max_rows is not None and len(rows) >= max_rows):
            return rows
        start += size


@contextmanager
def constraint_errors(
    *,
    duplicate: str = "Já existe um registro com esses dados",
    in_use: str = "Registro vinculado a outros dados",
) -> Iterator[None]:
    """Converte violações de UNIQUE / FK do Postgres em 409."""
    try:
        yield
    except APIError as exc:
        if exc.code == PG_UNIQUE_VIOLATION:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=duplicate) from exc
        if exc.code == PG_FOREIGN_KEY_VIOLATION:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=in_use) from exc
        raise


def reject_nulls(patch: dict[str, Any], fields: Iterable[str]) -> None:
    nulos = [f for f in fields if f in patch and patch[f] is None]
    if nulos:
        raise HTTPException(
            status_code=422,
            detail=f"Campos obrigatórios não podem ser nulos: {', '.join(nulos)}",
        )
