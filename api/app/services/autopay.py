"""Autopay: a resident saves a card or bank account once, and rent is paid from it on the day it's due.

Turning it on goes through Stripe Checkout in setup mode, so card numbers never touch this server.
Each charge is tried once. A failed try tells the resident and the owners, and the charge waits to be
paid by hand (or is tried again if the resident saves a new card). Without Stripe keys it runs in test
mode, like the pay button: nothing is charged and the charge is marked paid as a test.
"""

import hashlib
from datetime import datetime

import stripe
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..db import now
from ..models import Charge, Resident
from . import notify
from .email import site_url
from .fmt import first_name, money
from .payments import apply_plan, notify_owner, plan_for

TEST_LABEL = "Test card"


def _id(v) -> str | None:
    return v.get("id") if isinstance(v, dict) else v


def _label(pm: dict) -> str:
    if pm.get("type") == "us_bank_account":
        b = pm.get("us_bank_account") or {}
        return f"Bank account ending {b.get('last4', '')}".strip()
    card = pm.get("card") or {}
    return f"{str(card.get('brand', 'Card')).title()} ending {card.get('last4', '')}".strip()


def _method(r: Resident) -> str:
    return "ACH" if (r.autopayLabel or "").startswith("Bank account") else "STRIPE"


def start(db: Session, r: Resident, token: str) -> str:
    """Where to send the resident to turn autopay on: Stripe's secure page, or straight back in test mode."""
    if not r.active:
        raise HTTPException(403, "Autopay is closed now that you've moved out.")
    s = get_settings()
    if not s.stripe_enabled:
        _turn_on(db, r, None, TEST_LABEL)
        return f"/portal/{token}?autopay=on"
    if not r.stripeCustomerId:
        r.stripeCustomerId = stripe.Customer.create(
            api_key=s.stripe_secret_key, name=r.name, email=r.email or None, metadata={"residentId": r.id},
        ).id
        db.commit()
    base = site_url()
    session = stripe.checkout.Session.create(
        api_key=s.stripe_secret_key,
        mode="setup",
        currency="usd",
        customer=r.stripeCustomerId,
        payment_method_types=["card", "us_bank_account"],
        metadata={"purpose": "autopay", "residentId": r.id},
        setup_intent_data={"metadata": {"purpose": "autopay", "residentId": r.id}},
        success_url=f"{base}/portal/{token}?autopay_session={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base}/portal/{token}",
    )
    return session.url


def finish(db: Session, session: dict, resident_id: str | None = None) -> bool:
    """Saves the card or bank account from a completed setup session. Safe to call more than once."""
    meta = session.get("metadata") or {}
    if session.get("mode") != "setup" or meta.get("purpose") != "autopay" or session.get("status") != "complete":
        return False
    if resident_id and meta.get("residentId") != resident_id:
        return False
    r = db.get(Resident, meta.get("residentId"))
    if not r:
        return False
    key = get_settings().stripe_secret_key
    si = stripe.SetupIntent.retrieve(_id(session.get("setup_intent")), api_key=key, expand=["payment_method"])
    pm = si.get("payment_method")
    if not isinstance(pm, dict) or not pm.get("id"):
        return False
    if r.autopay and r.stripePaymentMethodId == pm["id"]:
        return True
    r.stripeCustomerId = _id(session.get("customer")) or r.stripeCustomerId
    _turn_on(db, r, pm["id"], _label(pm))
    return True


def _turn_on(db: Session, r: Resident, pm_id: str | None, label: str) -> None:
    r.autopay, r.stripePaymentMethodId, r.autopayLabel = True, pm_id, label
    # anything autopay couldn't pay before gets another try with the new card
    for c in r.charges:
        if c.status == "DUE" and c.autopayStatus == "FAILED":
            c.autopayAt = c.autopayStatus = None
    notify.owner(db, "autopay.on", f"{r.name} turned on autopay", f"Rent will be paid on its due date with their {label}.", f"/admin/residents/{r.id}")
    db.commit()


def stop(db: Session, r: Resident) -> None:
    r.autopay, r.stripePaymentMethodId, r.autopayLabel = False, None, None
    db.commit()


# ───── Charging ─────

def _key(ids: list[str]) -> str:
    return "respite-autopay-" + hashlib.sha256(",".join(sorted(ids)).encode()).hexdigest()[:32]


def run(db: Session, at: datetime | None = None) -> int:
    """Pays every charge that's due today or earlier for residents with autopay on. Returns how many residents were charged."""
    current = at or now()
    charges = db.scalars(
        select(Charge)
        .join(Resident)
        .options(selectinload(Charge.resident))
        .where(Charge.status == "DUE", Charge.autopayAt.is_(None), Charge.dueDate <= current, Resident.autopay.is_(True), Resident.active.is_(True))
        .order_by(Charge.dueDate)
    ).all()
    by_resident: dict[str, list[Charge]] = {}
    for c in charges:
        by_resident.setdefault(c.residentId, []).append(c)
    s = get_settings()
    for cs in by_resident.values():
        r = cs[0].resident
        for c in cs:
            c.autopayAt = current
        db.commit()  # marked before charging, so a crash can never charge twice
        ids = [c.id for c in cs]
        total = sum(c.amountCents for c in cs)
        if not s.stripe_enabled:
            notify_owner(db, apply_plan(db, plan_for(cs, None), "DEMO", r.id))
            continue
        if not r.stripePaymentMethodId:
            _failed(db, r, cs, "there's no card or bank account saved")
            continue
        try:
            pi = stripe.PaymentIntent.create(
                api_key=s.stripe_secret_key,
                amount=total,
                currency="usd",
                customer=r.stripeCustomerId,
                payment_method=r.stripePaymentMethodId,
                payment_method_types=["card", "us_bank_account"],
                off_session=True,
                confirm=True,
                description=f"Respite for the Weary autopay, {r.name}",
                metadata={"purpose": "autopay", "residentId": r.id, "chargeIds": ",".join(ids)},
                idempotency_key=_key(ids),
            )
        except stripe.StripeError as e:
            _failed(db, r, cs, e.user_message or "the payment was declined")
            continue
        settle(db, pi.to_dict() if hasattr(pi, "to_dict") else dict(pi))
    return len(by_resident)


def settle(db: Session, pi: dict) -> None:
    """Records what happened to an autopay payment: paid, still clearing (bank), or failed. Webhooks land here too."""
    meta = pi.get("metadata") or {}
    if meta.get("purpose") != "autopay":
        return
    r = db.get(Resident, meta.get("residentId"))
    if not r:
        return
    cs = [c for c in (db.get(Charge, i) for i in str(meta.get("chargeIds", "")).split(",") if i) if c and c.status == "DUE"]
    if not cs:
        return
    status = pi.get("status")
    if status == "succeeded":
        ids = apply_plan(db, plan_for(cs, None), _method(r), r.id, stripePaymentIntentId=pi.get("id"))
        for c in cs:
            c.autopayStatus = None
        db.commit()
        notify_owner(db, ids)
    elif status == "processing":
        for c in cs:
            c.autopayStatus = "PROCESSING"
        db.commit()
    else:
        err = pi.get("last_payment_error") or {}
        _failed(db, r, cs, err.get("message") or "the payment didn't go through")


def _failed(db: Session, r: Resident, cs: list[Charge], why: str) -> None:
    total = sum(c.amountCents for c in cs)
    for c in cs:
        c.autopayStatus = "FAILED"
    link = f"{site_url()}/portal/{r.portalToken}"
    notify.email(
        db, r.email, f"Autopay couldn't pay {money(total)}",
        f"Hi {first_name(r.name)},\n\nWe tried to pay {money(total)} with your {r.autopayLabel or 'saved payment method'}, but {why}.\n\n"
        f"You can pay here, or save a different card and we'll try again: {link}\n\nIf you need more time, call the house.",
        "autopay.failed",
    )
    notify.owner(
        db, "autopay.failed", f"Autopay didn't go through for {r.name}",
        f"{money(total)} with their {r.autopayLabel or 'saved payment method'}: {why}. They've been emailed their pay link.",
        f"/admin/residents/{r.id}",
    )
    db.commit()
