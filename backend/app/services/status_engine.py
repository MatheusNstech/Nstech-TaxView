from calendar import monthrange
from datetime import date, datetime, timedelta

from app.core.clock import BR_TZ, today_br

ACTIVE_STATUSES = {"PENDENTE", "EM_ANDAMENTO", "EM_REVISAO", "ATRASADO"}
# Entrega parcial já conta como entregue: para o relógio do prazo e soma em Entregue.
DELIVERED_STATUSES = {"ENTREGUE", "ENTREGA_PARCIAL"}


def is_delivered(status: str | None) -> bool:
    return status in DELIVERED_STATUSES


def status_filter_values(status: str) -> list[str]:
    """Filtro "Entregue" também traz as entregas parciais."""
    return sorted(DELIVERED_STATUSES) if status == "ENTREGUE" else [status]


def as_br_date(value: object) -> date | None:
    """Data (dia civil de Brasília) de um date, datetime ou string ISO."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.astimezone(BR_TZ).date() if value.tzinfo else value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if len(text) <= 10:
        try:
            return date.fromisoformat(text)
        except ValueError:
            return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.astimezone(BR_TZ).date() if parsed.tzinfo else parsed.date()


def clamp_day(year: int, month: int, day: int) -> date:
    last = monthrange(year, month)[1]
    return date(year, month, min(day, last))


def compute_prazo(competencia: date, dia: int | None) -> date | None:
    if dia is None:
        return None
    month = competencia.month + 1
    year = competencia.year
    if month > 12:
        month = 1
        year += 1
    return clamp_day(year, month, dia)


def _reference_day(entrega_original: date | None, today: date | None) -> date:
    """Item reaberto mede o atraso pela entrega original, não por hoje."""
    return entrega_original or today or today_br()


def normalize_status(
    status: str,
    prazo_legal: date | None,
    prazo_fiscal: date | None,
    data_entrega: date | None,
    today: date | None = None,
    entrega_original: date | None = None,
) -> str:
    if status == "ENTREGA_PARCIAL":
        return status
    if data_entrega is not None or status == "ENTREGUE":
        return "ENTREGUE"
    # Em andamento / revisão mantêm a coluna do Kanban; urgência marca o atraso.
    if status in {"EM_ANDAMENTO", "EM_REVISAO"}:
        return status
    reference = prazo_fiscal or prazo_legal
    if reference is not None and reference < _reference_day(entrega_original, today):
        return "ATRASADO"
    if status in ACTIVE_STATUSES:
        return status
    return "PENDENTE"


def urgencia_label(
    status: str,
    prazo_legal: date | None,
    prazo_fiscal: date | None,
    today: date | None = None,
    entrega_original: date | None = None,
) -> str:
    if is_delivered(status):
        return "ok"
    reference = prazo_fiscal or prazo_legal
    if reference is None:
        return "neutro"
    day = _reference_day(entrega_original, today)
    if reference < day:
        return "atrasado"
    if entrega_original is not None:
        return "ok"
    if reference <= day + timedelta(days=7):
        return "urgente"
    return "ok"
