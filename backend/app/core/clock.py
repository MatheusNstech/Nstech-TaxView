from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

# Prazos fiscais seguem o dia civil de Brasília; o servidor (Vercel) roda em UTC.
BR_TZ = ZoneInfo("America/Sao_Paulo")


def now_br() -> datetime:
    return datetime.now(BR_TZ)


def today_br() -> date:
    return now_br().date()
