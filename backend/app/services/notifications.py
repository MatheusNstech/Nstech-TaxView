"""Helpers: resolve responsável do usuário e write audit / notifications."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from supabase import Client


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
        start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
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


def notify_responsavel_of_obrigacao(
    client: Client,
    *,
    obrigacao_id: str,
    tipo: str,
    titulo: str,
    corpo: str = "",
    dedupe_same_day: bool = False,
    exclude_user_id: str | None = None,
) -> int:
    row = (
        client.table("obrigacoes")
        .select("id,responsavel_id,responsaveis(auth_user_id,nome)")
        .eq("id", obrigacao_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not row:
        return 0
    resp = row[0].get("responsaveis") or {}
    auth_id = resp.get("auth_user_id")
    if not auth_id or auth_id == exclude_user_id:
        return 0
    created = create_notification(
        client,
        user_id=auth_id,
        tipo=tipo,
        titulo=titulo,
        corpo=corpo,
        obrigacao_id=obrigacao_id,
        dedupe_same_day=dedupe_same_day,
    )
    return 1 if created else 0


def scan_prazo_7d(client: Client, today: date | None = None) -> int:
    today = today or date.today()
    end = date.fromordinal(today.toordinal() + 7)
    rows = (
        client.table("obrigacoes")
        .select("id,prazo_legal,prazo_fiscal,status,responsaveis(auth_user_id)")
        .neq("status", "ENTREGUE")
        .execute()
        .data
        or []
    )
    created = 0
    for row in rows:
        prazo = row.get("prazo_fiscal") or row.get("prazo_legal")
        if not prazo:
            continue
        d = date.fromisoformat(prazo)
        if not (today <= d <= end):
            continue
        auth_id = (row.get("responsaveis") or {}).get("auth_user_id")
        if not auth_id:
            continue
        if create_notification(
            client,
            user_id=auth_id,
            tipo="PRAZO_7D",
            titulo="Prazo em até 7 dias",
            corpo=f"Obrigação vence em {prazo}",
            obrigacao_id=row["id"],
            dedupe_same_day=True,
        ):
            created += 1
    return created
