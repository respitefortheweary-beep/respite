"""Money in and money back: Stripe checkouts, in-person payments and refunds."""

import stripe
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..db import now
from ..models import Charge
from . import notify
from .email import site_url
from .fmt import first_name, money
from .labels import IN_PERSON_METHODS


def notify_owner(db: Session, charge_ids: list[str]) -> None:
    if not charge_ids:
        return
    charges = db.scalars(select(Charge).where(Charge.id.in_(charge_ids)).options(selectinload(Charge.resident))).all()
    if not charges:
        return
    total = sum(c.amountCents for c in charges)
    r = charges[0].resident
    notify.owner(
        db, "payment.received", f"{r.name} paid {money(total)}",
        "\n".join(f"• {c.label}: {money(c.amountCents)}" for c in charges),
        f"/admin/residents/{r.id}",
    )
    db.commit()


# ───── Paying all or part ─────

Plan = list[tuple[str, int | None]]  # (charge id, cents toward it); None pays it in full


def plan_for(charges: list[Charge], amount_cents: int | None) -> Plan:
    """Spreads a payment over the charges, oldest first. Only the last one touched can be paid in part."""
    if amount_cents is None:
        return [(c.id, None) for c in charges]
    plan: Plan = []
    left = amount_cents
    for c in charges:
        if left <= 0:
            break
        plan.append((c.id, None if left >= c.amountCents else left))
        left -= c.amountCents
    return plan


def plan_to_meta(plan: Plan) -> dict:
    part = next(((i, n) for i, n in plan if n is not None), None)
    return {"chargeIds": ",".join(i for i, _ in plan), **({"part": f"{part[0]}:{part[1]}"} if part else {})}


def plan_from_meta(meta: dict) -> Plan:
    part_id, _, part_cents = str(meta.get("part", "")).partition(":")
    return [(i, int(part_cents) if i == part_id and part_cents.isdigit() else None) for i in str(meta.get("chargeIds", "")).split(",") if i]


def apply_plan(db: Session, plan: Plan, method: str, resident_id: str | None = None, **stripe_ids) -> list[str]:
    """Marks charges paid. A part payment splits the charge: a paid piece, and the rest still owed under the original."""
    paid: list[str] = []
    when = now()
    for cid, cents in plan:
        c = db.get(Charge, cid)
        if not c or c.status != "DUE" or (resident_id and c.residentId != resident_id):
            continue
        if cents is None or cents >= c.amountCents:
            c.status, c.paidAt, c.method = "PAID", when, method
            for k, v in stripe_ids.items():
                setattr(c, k, v)
            paid.append(c.id)
        elif cents > 0:
            piece = Charge(
                residentId=c.residentId, label=f"{c.label} (part)", amountCents=cents, dueDate=c.dueDate,
                status="PAID", paidAt=when, method=method, **stripe_ids,
            )
            c.amountCents -= cents
            db.add(piece)
            db.flush()
            paid.append(piece.id)
    db.commit()
    return paid


def settle_session(db: Session, session: dict, resident_id: str | None = None) -> bool:
    """Marks the charges in a paid Stripe Checkout Session as paid. Safe to call more than once."""
    if session.get("payment_status") != "paid":
        return False
    meta = session.get("metadata") or {}
    if resident_id and meta.get("residentId") != resident_id:
        return False
    plan = plan_from_meta(meta)
    if not plan:
        return False
    if db.scalar(select(Charge.id).where(Charge.stripeSessionId == session.get("id")).limit(1)):
        return True  # already recorded (the return page and the webhook both land here)
    types = session.get("payment_method_types") or []
    pi = session.get("payment_intent")
    pi = pi.get("id") if isinstance(pi, dict) else pi
    ids = apply_plan(
        db, plan, "ACH" if types == ["us_bank_account"] else "STRIPE", meta.get("residentId"),
        stripeSessionId=session.get("id"), stripePaymentIntentId=pi,
    )
    notify_owner(db, ids)
    return True


# ───── Paying in person ─────

def plan_in_person(db: Session, charges: list[Charge], method: str) -> None:
    """The resident says they'll bring these to the house. The owners are told what to expect."""
    if method not in IN_PERSON_METHODS:
        raise HTTPException(400, "Choose how you'll pay.")
    when = now()
    for c in charges:
        c.inPersonMethod, c.inPersonAt = method, when
    r = charges[0].resident
    total = sum(c.amountCents for c in charges)
    notify.owner(
        db, "payment.in_person", f"{r.name} will pay {money(total)} in person, with {IN_PERSON_METHODS[method]}",
        "\n".join(f"• {c.label}: {money(c.amountCents)}" for c in charges)
        + "\n\nWhen you have it, open their page and mark it paid. They'll get a receipt by email.",
        f"/admin/residents/{r.id}",
    )
    db.commit()


def send_receipt(db: Session, c: Charge) -> None:
    """Emails the resident a receipt for a payment the house took by hand."""
    r = c.resident
    how = IN_PERSON_METHODS.get(c.method or "", "in person")
    notify.email(
        db, r.email, f"Receipt: {money(c.amountCents)} for {c.label}",
        f"Hi {first_name(r.name)},\n\nWe received {money(c.amountCents)} from you, paid with {how}, for {c.label}. Thank you.\n\n"
        f"Your payments and statement are always here: {site_url()}/portal/{r.portalToken}",
        "payment.receipt",
    )


# ───── Refunds ─────

def _payment_intent(c: Charge, key: str) -> str:
    if c.stripePaymentIntentId:
        return c.stripePaymentIntentId
    session = stripe.checkout.Session.retrieve(c.stripeSessionId, api_key=key)
    pi = session.get("payment_intent")
    pi = pi.get("id") if isinstance(pi, dict) else pi
    if not pi:
        raise HTTPException(409, "Stripe has no payment for this charge, so there's nothing to refund there.")
    c.stripePaymentIntentId = pi
    return pi


def refund(db: Session, c: Charge, note: str) -> dict:
    """Gives a paid charge back in full: through Stripe when it was paid online, otherwise it records cash handed back."""
    if c.status != "PAID":
        raise HTTPException(409, "Only a paid charge can be refunded.")
    online = bool(c.stripeSessionId or c.stripePaymentIntentId)
    if online:
        s = get_settings()
        if not s.stripe_enabled:
            raise HTTPException(409, "This was paid through Stripe, and Stripe isn't connected right now. Refund it from your Stripe dashboard.")
        try:
            r = stripe.Refund.create(
                api_key=s.stripe_secret_key,
                payment_intent=_payment_intent(c, s.stripe_secret_key),
                amount=c.amountCents,
                reason="requested_by_customer",
                metadata={"chargeId": c.id, "residentId": c.residentId},
                idempotency_key=f"respite-refund-{c.id}",  # a double click can't refund twice
            )
        except stripe.StripeError as e:
            raise HTTPException(502, f"Stripe didn't accept the refund: {e.user_message or 'try again in a minute.'}") from None
        c.stripeRefundId = r.id
    c.status, c.refundedAt, c.refundNote = "REFUNDED", now(), note or None

    res = c.resident
    if online:
        text = (
            f"Hi {first_name(res.name)},\n\nWe've refunded {money(c.amountCents)} for {c.label}. "
            "It goes back to the card or bank account you paid with. Card refunds usually show up in 5 to 10 business days, bank refunds can take a little longer."
        )
    else:
        text = f"Hi {first_name(res.name)},\n\nThis confirms we gave you back {money(c.amountCents)} for {c.label}."
    if note:
        text += f"\n\nNote from the house: {note}"
    notify.email(db, res.email, f"Refund: {money(c.amountCents)} for {c.label}", text, "payment.refunded")
    db.commit()
    return {"ok": f"Refunded {money(c.amountCents)}" + (" through Stripe." if online else ".")}


def refund_failed(db: Session, refund_obj: dict) -> None:
    """A Stripe refund that bounced (it happens with bank accounts): the charge counts as paid again and the owners hear about it."""
    if refund_obj.get("status") not in ("failed", "canceled"):
        return
    c = db.scalar(select(Charge).where(Charge.stripeRefundId == refund_obj.get("id")).options(selectinload(Charge.resident)))
    if not c or c.status != "REFUNDED":
        return
    c.status, c.refundedAt = "PAID", None
    notify.owner(
        db, "payment.refund_failed", f"The refund to {c.resident.name} didn't go through",
        f"Stripe couldn't return {money(c.amountCents)} for {c.label} ({refund_obj.get('failure_reason') or refund_obj.get('status')}). "
        "It's marked paid again. Check the payment in Stripe, or give it back another way.",
        f"/admin/residents/{c.residentId}",
    )
    db.commit()


def refunded_in_stripe(db: Session, charge_obj: dict) -> None:
    """Keeps the books right when a payment is refunded from the Stripe dashboard instead of here."""
    pi = charge_obj.get("payment_intent")
    if not pi:
        return
    linked = db.scalars(select(Charge).where(Charge.stripePaymentIntentId == pi).options(selectinload(Charge.resident))).all()
    charges = [c for c in linked if c.status == "PAID"]
    # refunds made here show up in this event too; only act on money Stripe sent back beyond those
    ours = sum(c.amountCents for c in linked if c.status == "REFUNDED")
    if not charges or (charge_obj.get("amount_refunded") or 0) <= ours:
        return
    if charge_obj.get("refunded"):  # the whole payment went back
        for c in charges:
            c.status, c.refundedAt, c.refundNote = "REFUNDED", now(), "Refunded from the Stripe dashboard."
        db.commit()
        return
    r = charges[0].resident
    notify.owner(
        db, "payment.refunded", f"Part of {r.name}'s payment was refunded in Stripe",
        f"{money(charge_obj.get('amount_refunded') or 0)} of a {money(charge_obj.get('amount') or 0)} payment went back. "
        "The charges here are still marked paid. Adjust them on their page if needed.",
        f"/admin/residents/{r.id}",
    )
    db.commit()
