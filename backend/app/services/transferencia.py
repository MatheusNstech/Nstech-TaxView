"""Pegar/enviar tarefas e obrigações entre colegas: troca o dono, registra e avisa."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException, status
from supabase import Client

from app.core.auth import AuthUser
from app.services.notifications import create_notification, write_audit
from app.services.obrigacao_responsaveis import responsavel_ids_of, set_responsaveis
from app.services.scope import resolve_responsavel, team_responsavel_ids
from app.services.status_engine import is_delivered

logger = logging.getLogger(__name__)

_RESP_COLUMNS = "id,nome,auth_user_id,ativo"


def frase_transferencia(
    ator: dict[str, Any],
    de: dict[str, Any],
    para: dict[str, Any],
    tipo: str,
) -> str:
    """`tipo` = "tarefa" ou "obrigação"."""
    nome_ator = ator.get("nome") or "Alguém"
    nome_de = de.get("nome") or "?"
    nome_para = para.get("nome") or "?"
    ator_id = str(ator.get("id") or "")
    if ator_id and ator_id == str(para.get("id") or ""):
        return f"{nome_ator} pegou a {tipo} de {nome_de}"
    if ator_id and ator_id == str(de.get("id") or ""):
        return f"{nome_ator} enviou a {tipo} para {nome_para}"
    return f"{nome_ator} passou a {tipo} de {nome_de} para {nome_para}"


def _responsavel(client: Client, responsavel_id: str | None) -> dict[str, Any] | None:
    if not responsavel_id:
        return None
    rows = (
        client.table("responsaveis")
        .select(_RESP_COLUMNS)
        .eq("id", str(responsavel_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def validar_destino(
    user: AuthUser,
    client: Client,
    destino_id: str,
    dono_atual_id: str | None,
) -> dict[str, Any]:
    if dono_atual_id and str(destino_id) == str(dono_atual_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O item já é desse responsável",
        )
    destino = _responsavel(client, destino_id)
    if not destino:
        raise HTTPException(status_code=404, detail="Responsável não encontrado")
    if not destino.get("ativo", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Responsável inativo",
        )
    if not user.org_wide and str(destino_id) not in team_responsavel_ids(user, client):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Só é possível transferir para colegas da sua equipe",
        )
    return destino


def _ator(user: AuthUser, client: Client) -> dict[str, Any]:
    ator = resolve_responsavel(user, client) or {}
    return {"id": ator.get("id"), "nome": ator.get("nome") or user.email or "Alguém"}


def _bloquear_entregue(entregue: bool) -> None:
    if entregue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reabra o item antes de transferir",
        )


def _com_motivo(frase: str, motivo: str | None) -> str:
    motivo = (motivo or "").strip()
    return f"{frase} · Motivo: {motivo}" if motivo else frase


def _corpo(*partes: str | None) -> str:
    return " · ".join(p.strip() for p in partes if p and p.strip())


def _avisar(
    client: Client,
    user: AuthUser,
    envolvidos: list[dict[str, Any]],
    *,
    titulo: str,
    corpo: str,
    obrigacao_id: str | None = None,
) -> None:
    """Avisa o antigo e o novo dono, nunca quem fez a ação."""
    alvos = {
        str(r["auth_user_id"])
        for r in envolvidos
        if r and r.get("auth_user_id") and str(r["auth_user_id"]) != user.id
    }
    for alvo in sorted(alvos):
        create_notification(
            client,
            user_id=alvo,
            tipo="ATRIBUICAO",
            titulo=titulo,
            corpo=corpo,
            obrigacao_id=obrigacao_id,
        )


def _nome_de(client: Client, table: str, row_id: str | None, column: str) -> str | None:
    if not row_id:
        return None
    rows = (
        client.table(table).select(f"id,{column}").eq("id", str(row_id)).limit(1).execute().data
        or []
    )
    return rows[0].get(column) if rows else None


def transferir_tarefa(
    client: Client,
    user: AuthUser,
    tarefa: dict[str, Any],
    destino_id: str,
    motivo: str | None,
) -> str:
    """`tarefa` = linha já validada no escopo. Devolve a frase registrada."""
    _bloquear_entregue(is_delivered(tarefa.get("status")))
    dono_id = str(tarefa.get("responsavel_id") or "") or None
    destino = validar_destino(user, client, destino_id, dono_id)
    dono = _responsavel(client, dono_id) or {"id": dono_id}
    tid = str(tarefa["id"])

    updated = (
        client.table("tarefas")
        .update({"responsavel_id": str(destino["id"])})
        .eq("id", tid)
        .execute()
        .data
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível transferir a tarefa. Tente de novo.",
        )
    frase = frase_transferencia(_ator(user, client), dono, destino, "tarefa")
    try:
        client.table("tarefa_audit_log").insert(
            {"tarefa_id": tid, "user_id": user.id, "acao": _com_motivo(frase, motivo)}
        ).execute()
        atual = updated[0]
        _avisar(
            client,
            user,
            [dono, destino],
            titulo=frase,
            corpo=_corpo(
                atual.get("titulo"),
                _nome_de(client, "empresas", atual.get("empresa_id"), "razao_social"),
                f"Motivo: {motivo.strip()}" if motivo and motivo.strip() else None,
            ),
        )
    except Exception:  # noqa: BLE001
        logger.exception("Falha ao registrar transferência tarefa=%s", tid)
    return frase


def transferir_obrigacao(
    client: Client,
    user: AuthUser,
    obrigacao_id: str,
    destino_id: str,
    motivo: str | None,
) -> str:
    rows = (
        client.table("obrigacoes")
        .select("id,status,data_entrega,responsavel_id,atividade_id,empresa_id")
        .eq("id", obrigacao_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Obrigação não encontrada")
    atual = rows[0]
    _bloquear_entregue(is_delivered(atual.get("status")) or bool(atual.get("data_entrega")))
    dono_id = str(atual.get("responsavel_id") or "") or None
    destino = validar_destino(user, client, destino_id, dono_id)
    dono = _responsavel(client, dono_id) or {"id": dono_id}
    novo_id = str(destino["id"])

    vinculos = responsavel_ids_of(client, obrigacao_id)
    updated = (
        client.table("obrigacoes")
        .update({"responsavel_id": novo_id, "updated_by": user.id})
        .eq("id", obrigacao_id)
        .execute()
        .data
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para alterar esta obrigação",
        )
    # O principal antigo sai do vínculo; os co-responsáveis ficam.
    set_responsaveis(client, obrigacao_id, (vinculos - {dono_id or ""}) | {novo_id}, novo_id)

    frase = frase_transferencia(_ator(user, client), dono, destino, "obrigação")
    try:
        write_audit(
            client,
            obrigacao_id=obrigacao_id,
            user_id=user.id,
            acao=_com_motivo(frase, motivo),
            campo="responsavel_id",
            valor_anterior=dono.get("nome"),
            valor_novo=destino.get("nome"),
        )
        _avisar(
            client,
            user,
            [dono, destino],
            titulo=frase,
            corpo=_corpo(
                _nome_de(client, "atividades_modelo", atual.get("atividade_id"), "nome"),
                _nome_de(client, "empresas", atual.get("empresa_id"), "razao_social"),
                f"Motivo: {motivo.strip()}" if motivo and motivo.strip() else None,
            ),
            obrigacao_id=obrigacao_id,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Falha ao registrar transferência obrigacao=%s", obrigacao_id)
    return frase
