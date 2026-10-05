"""Ações de um colega da equipe em item de outra pessoa: histórico + aviso ao dono."""
from __future__ import annotations

import logging
from typing import Any

from supabase import Client

from app.core.auth import AuthUser
from app.services.notifications import (
    create_notification,
    notify_responsavel_of_obrigacao,
    write_audit,
)
from app.services.scope import resolve_responsavel

logger = logging.getLogger(__name__)

_STATUS_LABELS = {
    "PENDENTE": "Pendente",
    "EM_ANDAMENTO": "Em andamento",
    "EM_REVISAO": "Em revisão",
    "ENTREGUE": "Entregue",
    "ATRASADO": "Atrasado",
}


def frase_acao_equipe(
    ator: str,
    donos: list[str],
    status_antes: str | None,
    status_depois: str | None,
) -> str:
    dono = " / ".join(donos)
    if status_depois == "ENTREGUE" and status_antes != "ENTREGUE":
        return f"{ator} entregou a tarefa de {dono}"
    if status_depois and status_depois != status_antes:
        label = _STATUS_LABELS.get(status_depois, status_depois)
        return f"{ator} moveu a tarefa de {dono} para {label}"
    return f"{ator} alterou a tarefa de {dono}"


def _ator_de_fora(
    user: AuthUser,
    client: Client,
    donos: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Responsável de quem agiu, se ele não for um dos donos do item."""
    ator = resolve_responsavel(user, client)
    if not ator or not donos:
        return None
    if str(ator.get("id")) in {str(d.get("id")) for d in donos}:
        return None
    return ator


def _corpo(*partes: str | None) -> str:
    return " · ".join(p.strip() for p in partes if p and p.strip())


def registrar_acao_equipe_obrigacao(
    client: Client,
    user: AuthUser,
    obrigacao: dict[str, Any],
    *,
    status_antes: str | None,
) -> str | None:
    """`obrigacao` já enriquecida (responsaveis, atividade, empresa)."""
    donos = obrigacao.get("responsaveis") or []
    ator = _ator_de_fora(user, client, donos)
    if not ator:
        return None
    frase = frase_acao_equipe(
        ator.get("nome") or "Alguém",
        [d.get("nome") or "?" for d in donos],
        status_antes,
        obrigacao.get("status"),
    )
    oid = str(obrigacao["id"])
    try:
        write_audit(client, obrigacao_id=oid, user_id=user.id, acao=frase)
        notify_responsavel_of_obrigacao(
            client,
            obrigacao_id=oid,
            tipo="EQUIPE",
            titulo=frase,
            corpo=_corpo(
                (obrigacao.get("atividade") or {}).get("nome"),
                (obrigacao.get("empresa") or {}).get("razao_social"),
            ),
            exclude_user_id=user.id,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Falha ao registrar ação da equipe obrigacao=%s", oid)
    return frase


def registrar_acao_equipe_tarefa(
    client: Client,
    user: AuthUser,
    tarefa: dict[str, Any],
    *,
    status_antes: str | None,
) -> str | None:
    """`tarefa` já enriquecida (responsavel, empresa)."""
    dono = tarefa.get("responsavel") or {}
    ator = _ator_de_fora(user, client, [dono] if dono.get("id") else [])
    if not ator:
        return None
    frase = frase_acao_equipe(
        ator.get("nome") or "Alguém",
        [dono.get("nome") or "?"],
        status_antes,
        tarefa.get("status"),
    )
    tid = str(tarefa["id"])
    try:
        client.table("tarefa_audit_log").insert(
            {"tarefa_id": tid, "user_id": user.id, "acao": frase}
        ).execute()
        target = dono.get("auth_user_id")
        if target and str(target) != user.id:
            create_notification(
                client,
                user_id=str(target),
                tipo="EQUIPE",
                titulo=frase,
                corpo=_corpo(
                    tarefa.get("titulo"),
                    (tarefa.get("empresa") or {}).get("razao_social"),
                ),
            )
    except Exception:  # noqa: BLE001
        logger.exception("Falha ao registrar ação da equipe tarefa=%s", tid)
    return frase
