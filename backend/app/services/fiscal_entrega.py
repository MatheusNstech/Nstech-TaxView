"""Entrega e histórico das pendências RFB/PGFN e dos processos PER/DCOMP.

Item entregue sai do valor em aberto; reabrir devolve. Cada ação vira uma
linha em fiscal_audit_log (aba Histórico do modal).
"""
from __future__ import annotations

from datetime import date
from typing import Any, Literal
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client

from app.core.auth import AuthUser
from app.core.clock import today_br

Origem = Literal["pendencia", "perdcomp"]
AUDIT_TABLE = "fiscal_audit_log"


class EntregarBody(BaseModel):
    """Data da entrega (padrão: hoje) e observação opcional."""

    data: date | None = None
    observacao: str = Field(default="", max_length=2000)


class ReabrirBody(BaseModel):
    motivo: str = Field(default="", max_length=2000)


class FiscalAuditOut(BaseModel):
    id: UUID
    acao: str
    user_email: str = ""
    created_at: str


def is_entregue(row: dict[str, Any]) -> bool:
    return bool(row.get("entregue_em"))


def _fmt(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def registrar(
    client: Client, origem: Origem, item_id: str, user: AuthUser, acao: str
) -> None:
    """Grava o histórico sem derrubar a ação principal se falhar."""
    try:
        client.table(AUDIT_TABLE).insert(
            {
                "origem": origem,
                "item_id": item_id,
                "user_id": user.id,
                "user_email": user.email or "",
                "acao": acao,
            }
        ).execute()
    except Exception:  # noqa: BLE001 - histórico é acessório
        pass


def listar(client: Client, origem: Origem, item_id: str) -> list[dict[str, Any]]:
    return (
        client.table(AUDIT_TABLE)
        .select("id,acao,user_email,created_at")
        .eq("origem", origem)
        .eq("item_id", item_id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )


def apagar_historico(client: Client, origem: Origem, item_id: str) -> None:
    client.table(AUDIT_TABLE).delete().eq("origem", origem).eq("item_id", item_id).execute()


def payload_entrega(body: EntregarBody, user: AuthUser) -> tuple[dict[str, Any], str]:
    """Campos a gravar e o texto do histórico."""
    quando = body.data or today_br()
    if quando > today_br():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A data da entrega não pode ser no futuro",
        )
    obs = body.observacao.strip()
    acao = f"Marcado como entregue em {_fmt(quando)}"
    if obs:
        acao += f": {obs}"
    return (
        {"entregue_em": quando.isoformat(), "entregue_por": user.id, "entrega_obs": obs},
        acao,
    )


def payload_reabertura(row: dict[str, Any], body: ReabrirBody) -> tuple[dict[str, Any], str]:
    if not is_entregue(row):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O item não está entregue",
        )
    motivo = body.motivo.strip()
    acao = "Reaberto" + (f": {motivo}" if motivo else "")
    return {"entregue_em": None, "entregue_por": None, "entrega_obs": ""}, acao


def acao_edicao(rotulos: dict[str, str], antes: dict[str, Any], depois: dict[str, Any]) -> str | None:
    """'Editou Status e Data limite' com os campos que de fato mudaram."""
    mudou = [
        rotulo
        for campo, rotulo in rotulos.items()
        if campo in depois and str(antes.get(campo) or "") != str(depois.get(campo) or "")
    ]
    if not mudou:
        return None
    if len(mudou) == 1:
        return f"Editou {mudou[0]}"
    return f"Editou {', '.join(mudou[:-1])} e {mudou[-1]}"
