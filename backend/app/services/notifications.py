"""Helpers: resolve responsável do usuário e write audit / notifications."""
from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from supabase import Client

from app.core.clock import now_br


def sanitize_uuid(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"null", "none", "undefined"}:
        return None
    try:
        return str(UUID(text))
    except (ValueError, TypeError):
        return None


def get_responsavel_for_user(
    client: Client,
    user_id: str,
    *,
    view_as_responsavel_id: str | None = None,
) -> dict[str, Any] | None:
    view_as = sanitize_uuid(view_as_responsavel_id)
    if view_as:
        rows = (
            client.table("responsaveis")
            .select("id,nome,email,auth_user_id,capacidade_max,ativo")
            .eq("id", view_as)
            .limit(1)
            .execute()
            .data
            or []
        )
        return rows[0] if rows else None

    rows = (
        client.table("responsaveis")
        .select("id,nome,email,auth_user_id,capacidade_max,ativo")
        .eq("auth_user_id", user_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def write_audit(
    client: Client,
    *,
    obrigacao_id: str,
    user_id: str | None,
    acao: str,
    campo: str | None = None,
    valor_anterior: Any = None,
    valor_novo: Any = None,
) -> None:
    client.table("obrigacao_audit_log").insert(
        {
            "obrigacao_id": obrigacao_id,
            "user_id": user_id,
            "acao": acao,
            "campo": campo,
            "valor_anterior": None if valor_anterior is None else str(valor_anterior),
            "valor_novo": None if valor_novo is None else str(valor_novo),
        }
    ).execute()


AUDIT_FIELDS = (
    "status",
    "responsavel_id",
    "prazo_legal",
    "prazo_fiscal",
    "data_entrega",
    "recibo_path",
    "recibo_numero",
    "observacao",
    "aprovado_por",
    "aprovado_em",
    "reprovado_motivo",
)


def audit_diff(
    client: Client,
    *,
    obrigacao_id: str,
    user_id: str | None,
    before: dict[str, Any],
    after: dict[str, Any],
    acao: str = "UPDATE",
) -> None:
    for campo in AUDIT_FIELDS:
        old = before.get(campo)
        new = after.get(campo)
        if str(old or "") != str(new or ""):
            write_audit(
                client,
                obrigacao_id=obrigacao_id,
                user_id=user_id,
                acao=acao,
                campo=campo,
                valor_anterior=old,
                valor_novo=new,
            )


def create_notification(
    client: Client,
    *,
    user_id: str,
    tipo: str,
    titulo: str,
    corpo: str = "",
    obrigacao_id: str | None = None,
    dedupe_same_day: bool = False,
) -> bool:
    """Returns True if a notification was created."""
    if dedupe_same_day:
        start = now_br().replace(hour=0, minute=0, second=0, microsecond=0)
        query = (
            client.table("notificacoes")
            .select("id")
            .eq("user_id", user_id)
            .eq("tipo", tipo)
            .gte("created_at", start.isoformat())
        )
        if obrigacao_id:
            query = query.eq("obrigacao_id", obrigacao_id)
        else:
            query = query.eq("titulo", titulo).eq("corpo", corpo)
        existing = query.limit(1).execute().data or []
        if existing:
            return False

    client.table("notificacoes").insert(
        {
            "user_id": user_id,
            "obrigacao_id": obrigacao_id,
            "tipo": tipo,
            "titulo": titulo,
            "corpo": corpo,
            "lida": False,
        }
    ).execute()
    return True


def _fmt_prazo(prazo: str | None) -> str | None:
    if not prazo:
        return None
    try:
        return date.fromisoformat(prazo[:10]).strftime("%d/%m/%Y")
    except ValueError:
        return prazo


def format_alerta_obrigacao(
    *,
    nome: str | None,
    empresa: str | None,
    tipo: str,
    prazo: str | None = None,
) -> tuple[str, str]:
    titulo = (nome or "").strip() or "Obrigação"
    razao = (empresa or "").strip()
    vencimento = _fmt_prazo(prazo)
    if tipo == "PRAZO_7D":
        corpo = f"Vence em {vencimento}" if vencimento else "Vence em até 7 dias"
    else:
        corpo = "Atrasada"
    if razao:
        corpo = f"{corpo} · {razao}"
    return titulo, corpo


def notify_responsavel_of_obrigacao(
    client: Client,
    *,
    obrigacao_id: str,
    tipo: str,
    titulo: str,
    corpo: str = "",
    dedupe_same_day: bool = False,
    exclude_user_id: str | None = None,
    only_responsavel_ids: set[str] | None = None,
) -> int:
    """Notifica o principal e os co-responsáveis (ou só `only_responsavel_ids`)."""
    row = (
        client.table("obrigacoes")
        .select(
            "id,responsavel_id,responsaveis(id,auth_user_id),"
            "obrigacao_responsaveis(responsaveis(id,auth_user_id))"
        )
        .eq("id", obrigacao_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not row:
        return 0
    resps = [row[0].get("responsaveis") or {}]
    resps += [
        link.get("responsaveis") or {} for link in row[0].get("obrigacao_responsaveis") or []
    ]
    targets: set[str] = set()
    for resp in resps:
        auth_id = resp.get("auth_user_id")
        if not auth_id or auth_id == exclude_user_id:
            continue
        if only_responsavel_ids is not None and str(resp.get("id")) not in only_responsavel_ids:
            continue
        targets.add(str(auth_id))
    sent = 0
    for auth_id in sorted(targets):
        created = create_notification(
            client,
            user_id=auth_id,
            tipo=tipo,
            titulo=titulo,
            corpo=corpo,
            obrigacao_id=obrigacao_id,
            dedupe_same_day=dedupe_same_day,
        )
        if created:
            sent += 1
    return sent
