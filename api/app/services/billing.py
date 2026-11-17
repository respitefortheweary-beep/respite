import json
from datetime import datetime, timedelta

from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..db import now
from ..models import Charge, Resident, SiteContent
from . import notify
from .email import site_url
from .fmt import first_name, long_day, money, month_label, period
from .rent import STALE_AFTER


def bill_rent(db: Session, due: datetime) -> int:
    """Adds rent due on `due` for every active resident and emails each a pay link.

    Safe to run twice: anyone already billed for that month is skipped. Returns how many were billed.
    """
    p = period(due)
    residents = db.scalars(select(Resident).where(Resident.active.is_(True))).all()
    billed = {rid for rid in db.scalars(select(Charge.residentId).where(Charge.period == p))}
    created: list[Resident] = []
    for r in residents:
        if r.id in billed:
            continue
        db.add(Charge(residentId=r.id, label=f"{month_label(due)} rent", period=p, amountCents=r.rentCents, dueDate=due))
        created.append(r)
    for r in created:
        link = f"{site_url()}/portal/{r.portalToken}"
        how = (
            f"Autopay is on, so it will be paid on {long_day(due)} with your {r.autopayLabel or 'saved payment method'}.\nSee it here: {link}"
            if r.autopay
            else f"Pay here: {link}"
        )
        notify.email(
            db, r.email, f"{month_label(due)} rent: autopay is set" if r.autopay else f"{month_label(due)} rent is ready to pay",
            f"Hi {first_name(r.name)}, your {month_label(due)} rent of {money(r.rentCents)} is due {long_day(due)}.\n{how}",
            "rent.billed",
        )
    db.commit()  # the charges and their emails are saved together
    return len(created)


# ───── The house's billing rules, set by the owners ─────

KEY = "billing"
LATE_FEE_CAP = 0.10  # Virginia: no more than 10% of the rent or of what's still owed, whichever is less


class Policy(BaseModel):
    lateFeeCents: int = Field(default=0, ge=0, le=100_000)  # 0 means no late fees
    lateFeeAfterDays: int = Field(default=5, ge=1, le=30)  # days after the due date
    partialPayments: bool = True  # residents may pay part of what they owe
    minPartCents: int = Field(default=2_000, ge=100, le=100_000)  # smallest part payment


def get_policy(db: Session) -> Policy:
    found = db.get(SiteContent, KEY)
    if found:
        try:
            return Policy.model_validate(json.loads(found.value))
        except ValueError:
            pass
    return Policy()


def save_policy(db: Session, p: Policy) -> Policy:
    found = db.get(SiteContent, KEY)
    if found:
        found.value = p.model_dump_json()
    else:
        db.add(SiteContent(key=KEY, value=p.model_dump_json()))
    db.commit()
    return p


def late_fee_for(policy: Policy, owed_cents: int) -> int:
    return min(policy.lateFeeCents, int(owed_cents * LATE_FEE_CAP))


def add_late_fees(db: Session) -> int:
    """Adds one late fee to each rent charge still unpaid a set number of days after it was due.

    Never twice for the same rent, never for rent older than the overdue-reminder window, never while
    an autopay bank payment is still clearing. Returns how many fees were added.
    """
    policy = get_policy(db)
    if not policy.lateFeeCents:
        return 0
    current = now()
    late = db.scalars(
        select(Charge)
        .join(Resident)
        .options(selectinload(Charge.resident))
        .where(
            Charge.status == "DUE",
            Charge.period.is_not(None),
            Charge.dueDate <= current - timedelta(days=policy.lateFeeAfterDays),
            Charge.dueDate >= current - STALE_AFTER,
            or_(Charge.autopayStatus.is_(None), Charge.autopayStatus != "PROCESSING"),
            Resident.active.is_(True),
        )
    ).all()
    if not late:
        return 0
    has_fee = set(db.scalars(select(Charge.lateFeeForId).where(Charge.lateFeeForId.in_([c.id for c in late]))))
    added = 0
    for c in late:
        fee = late_fee_for(policy, c.amountCents)
        if c.id in has_fee or fee <= 0:
            continue
        db.add(Charge(residentId=c.residentId, label=f"Late fee, {c.label}", amountCents=fee, dueDate=current, lateFeeForId=c.id))
        r = c.resident
        notify.email(
            db, r.email, f"A {money(fee)} late fee was added",
            f"Hi {first_name(r.name)},\n\nYour {c.label} ({money(c.amountCents)}) is still unpaid, so a late fee of {money(fee)} was added, "
            f"as set out in the house rules.\n\nPay here: {site_url()}/portal/{r.portalToken}\n\n"
            "If something's going on, call the house. We'd much rather work it out with you.",
            "rent.late_fee",
        )
        added += 1
    db.commit()
    return added
