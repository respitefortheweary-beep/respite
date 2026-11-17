"""A resident's private pay page. The token in the URL is the only credential."""

import stripe
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..db import get_db, now
from ..models import Bed, Charge, RepairRequest, Resident
from ..serialize import row, rows
from ..services import notify
from ..services.email import site_url
from ..services import autopay
from ..services.billing import get_policy
from ..services.fmt import money
from ..services.payments import Plan, apply_plan, notify_owner, plan_for, plan_in_person, plan_to_meta, settle_session

router = APIRouter(prefix="/portal", tags=["resident portal"])


def _resident(db: Session, token: str) -> Resident:
    r = db.scalar(
        select(Resident)
        .where(Resident.portalToken == token)
        .options(selectinload(Resident.bed).selectinload(Bed.room), selectinload(Resident.charges))
    )
    if not r:
        raise HTTPException(404, "This pay link isn't valid.")
    return r


def _due(r: Resident, ids: list[str]) -> list[Charge]:
    return sorted(
        (c for c in r.charges if c.status == "DUE" and (not ids or c.id in ids)),
        key=lambda c: c.dueDate,
    )


@router.get("/{token}")
def portal(token: str, db: Session = Depends(get_db)):
    r = _resident(db, token)
    charges = sorted((c for c in r.charges if c.status != "VOID"), key=lambda c: c.dueDate, reverse=True)
    bed = row(r.bed, room=row(r.bed.room)) if r.bed else None
    out = row(r, bed=bed, charges=rows(charges))
    for k in ("portalToken", "stripeCustomerId", "stripePaymentMethodId"):
        out.pop(k)
    repairs = db.scalars(select(RepairRequest).where(RepairRequest.residentId == r.id).order_by(RepairRequest.createdAt.desc()).limit(20)).all()
    policy = get_policy(db)
    return out | {
        "stripeEnabled": get_settings().stripe_enabled,
        "repairs": rows(repairs),
        "policy": {"partialPayments": policy.partialPayments, "minPartCents": policy.minPartCents, "lateFeeCents": policy.lateFeeCents, "lateFeeAfterDays": policy.lateFeeAfterDays},
    }


@router.get("/{token}/statement")
def statement(token: str, db: Session = Depends(get_db)):
    from .records import statement as build  # here, not at the top: records is an admin module

    return build(db, _resident(db, token))


AREAS = ["Bedroom", "Bathroom", "Kitchen", "Laundry", "Heat or air", "Outside", "Other"]


class RepairIn(BaseModel):
    area: str = Field(max_length=40)
    body: str = Field(min_length=3, max_length=2000)
    urgent: bool = False


@router.post("/{token}/repairs", status_code=201)
def report_repair(token: str, body: RepairIn, db: Session = Depends(get_db)):
    r = _resident(db, token)
    if not r.active:
        raise HTTPException(403, "This page is closed now that you've moved out. Call the house if you need anything.")
    text = body.body.strip()
    if len(text) < 3:
        raise HTTPException(400, "Tell us what needs fixing.")
    area = body.area if body.area in AREAS else "Other"
    open_count = db.scalar(select(func.count()).select_from(RepairRequest).where(RepairRequest.residentId == r.id, RepairRequest.status != "DONE")) or 0
    if open_count >= 10:
        raise HTTPException(429, "You have 10 repairs waiting already. Call the house so we can sort them out together.")
    x = RepairRequest(residentId=r.id, area=area, body=text, urgent=body.urgent)
    db.add(x)
    where = f" ({r.bed.label})" if r.bed else ""
    notify.owner(
        db, "repair.new", f"{'Urgent repair' if body.urgent else 'Repair'}: {area}, {r.name}{where}",
        f'"{text}"' + (f"\n\nPhone: {r.phone}" if r.phone else ""), "/admin/repairs",
    )
    db.commit()
    return row(x)


@router.get("/{token}/due")
def due(token: str, ids: str = Query(""), db: Session = Depends(get_db)):
    r = _resident(db, token)
    return {"name": r.name, "charges": rows(_due(r, [i for i in ids.split(",") if i])), "stripeEnabled": get_settings().stripe_enabled}


class ChargesIn(BaseModel):
    chargeIds: list[str] = []
    amountCents: int | None = None  # pay only part; None pays it all


def _plan(db: Session, charges: list[Charge], amount: int | None) -> Plan:
    total = sum(c.amountCents for c in charges)
    if amount is None or amount >= total:
        return plan_for(charges, None)
    policy = get_policy(db)
    if not policy.partialPayments:
        raise HTTPException(400, "Part payments are turned off. Call the house to talk it through.")
    if amount < policy.minPartCents:
        raise HTTPException(400, f"The smallest payment is {money(policy.minPartCents)}.")
    return plan_for(charges, amount)


@router.post("/{token}/checkout")
def checkout(token: str, body: ChargesIn, db: Session = Depends(get_db)):
    """Returns where to send the resident: Stripe Checkout, or the test-mode pay screen."""
    r = _resident(db, token)
    charges = _due(r, body.chargeIds)
    if not charges:
        return {"url": f"/portal/{token}"}
    plan = _plan(db, charges, body.amountCents)
    s = get_settings()
    if not s.stripe_enabled:
        part = f"&a={body.amountCents}" if any(n is not None for _, n in plan) else ""
        return {"url": f"/portal/{token}/pay?c={','.join(i for i, _ in plan)}{part}"}
    by_id = {c.id: c for c in charges}
    base = site_url()
    session = stripe.checkout.Session.create(
        api_key=s.stripe_secret_key,
        mode="payment",
        payment_method_types=["card", "us_bank_account"],
        customer_email=r.email or None,
        line_items=[
            {
                "quantity": 1,
                "price_data": {
                    "currency": "usd",
                    "unit_amount": by_id[i].amountCents if n is None else n,
                    "product_data": {"name": by_id[i].label if n is None else f"{by_id[i].label} (part)"},
                },
            }
            for i, n in plan
        ],
        metadata={**plan_to_meta(plan), "residentId": r.id},
        payment_intent_data={"description": f"Respite for the Weary — {r.name}"},
        success_url=f"{base}/portal/{token}?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base}/portal/{token}",
    )
    return {"url": session.url}


@router.post("/{token}/demo-pay")
def demo_pay(token: str, body: ChargesIn, db: Session = Depends(get_db)):
    """Test mode only: records the payment without moving money."""
    if get_settings().stripe_enabled:
        raise HTTPException(403, "Test payments are off.")
    r = _resident(db, token)
    charges = _due(r, body.chargeIds)
    ids = apply_plan(db, _plan(db, charges, body.amountCents), "DEMO", r.id) if charges else []
    notify_owner(db, ids)
    return {"paid": len(ids)}


class SettleIn(BaseModel):
    sessionId: str


# ───── Autopay ─────

@router.post("/{token}/autopay")
def autopay_on(token: str, db: Session = Depends(get_db)):
    """Returns where to send the resident to save a card or bank account for autopay."""
    return {"url": autopay.start(db, _resident(db, token), token)}


@router.post("/{token}/autopay/confirm")
def autopay_confirm(token: str, body: SettleIn, db: Session = Depends(get_db)):
    """Called when Stripe sends the resident back, so autopay shows as on before the webhook lands."""
    s = get_settings()
    if not s.stripe_enabled:
        return {"on": False}
    r = _resident(db, token)
    try:
        session = stripe.checkout.Session.retrieve(body.sessionId, api_key=s.stripe_secret_key)
        return {"on": autopay.finish(db, session.to_dict(), resident_id=r.id)}
    except stripe.StripeError:
        return {"on": False}


@router.delete("/{token}/autopay")
def autopay_off(token: str, db: Session = Depends(get_db)):
    autopay.stop(db, _resident(db, token))
    return {"on": False}


class InPersonIn(ChargesIn):
    method: str


@router.post("/{token}/in-person")
def pay_in_person(token: str, body: InPersonIn, db: Session = Depends(get_db)):
    """The resident tells the house they'll bring cash, a check, a money order or a voucher."""
    r = _resident(db, token)
    charges = _due(r, body.chargeIds)
    if not charges:
        raise HTTPException(409, "There's nothing to pay right now.")
    plan_in_person(db, charges, body.method)
    return {"planned": len(charges)}


@router.post("/{token}/settle")
def settle(token: str, body: SettleIn, db: Session = Depends(get_db)):
    """Called when Stripe sends the resident back, so the page shows paid before the webhook lands."""
    s = get_settings()
    if not s.stripe_enabled:
        return {"paid": False}
    r = _resident(db, token)
    try:
        session = stripe.checkout.Session.retrieve(body.sessionId, api_key=s.stripe_secret_key)
    except stripe.StripeError:
        return {"paid": False}
    return {"paid": settle_session(db, session.to_dict(), resident_id=r.id)}
