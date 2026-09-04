from calendar import monthrange
from datetime import date, timedelta

ACTIVE_STATUSES = {"PENDENTE", "EM_ANDAMENTO", "EM_REVISAO", "ATRASADO"}


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


def normalize_status(
    status: str,
    prazo_legal: date | None,
    prazo_fiscal: date | None,
    data_entrega: date | None,
    today: date | None = None,
) -> str:
    today = today or date.today()
    if data_entrega is not None or status == "ENTREGUE":
        return "ENTREGUE"
    reference = prazo_fiscal or prazo_legal
    if reference is not None and reference < today:
        return "ATRASADO"
    if status in ACTIVE_STATUSES | {"ENTREGUE"}:
        return status
    return "PENDENTE"


def urgencia_label(
    status: str,
    prazo_legal: date | None,
    prazo_fiscal: date | None,
    today: date | None = None,
) -> str:
    today = today or date.today()
    if status == "ENTREGUE":
        return "ok"
    reference = prazo_fiscal or prazo_legal
    if reference is None:
        return "neutro"
    if reference < today:
        return "atrasado"
    if reference <= today + timedelta(days=7):
        return "urgente"
    return "ok"
