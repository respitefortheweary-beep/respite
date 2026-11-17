"""Things that run on a timer: autopay, late fees, tour reminders and overdue rent reminders.

The outbox worker calls run_chores every few minutes; hosts without the worker call /cron/notifications."""

from sqlalchemy.orm import Session

from . import autopay
from .billing import add_late_fees
from .rent import send_overdue_reminders
from .tours import send_reminders


def run_chores(db: Session) -> dict:
    # autopay first, so nobody who pays automatically is charged a late fee or reminded
    return {
        "autopaid": autopay.run(db),
        "lateFees": add_late_fees(db),
        "reminded": send_reminders(db),
        "overdue": send_overdue_reminders(db),
    }
