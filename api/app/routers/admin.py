"""Owner dashboard: requests, rooms and beds, residents, charges. Every route needs an owner login."""

import json
import logging
import re
import secrets
import time
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..db import get_db, now
from ..models import AdminUser, Bed, Charge, House, RepairRequest, Request, Resident, Room, Tour, WaitlistEntry
from ..security import current_admin, owner_only
from ..services.payments import apply_plan, refund, send_receipt
from ..serialize import row, rows
from ..services.availability import get_beds, get_houses, get_rooms_with_beds, sorted_beds
from ..services.houses import first_house_id, house_brief, make_slug, next_sort
from ..services.billing import Policy, bill_rent, get_policy, save_policy
from ..services import content, notify, tours, waitlist
from ..services.email import site_url
from .notifications import failed_count, unread_count
from ..services.fmt import first_name, money, month_label, month_start, parse_day, period
from ..services.labels import ACTIVE_STATUSES, PAY_METHODS, STATUSES
from ..services.storage import save_photo

log = logging.getLogger("respite.admin")
router = APIRouter(prefix="/admin", tags=["owner dashboard"], dependencies=[Depends(current_admin)])


def _get(db: Session, model, id_: str, what: str):
    obj = db.get(model, id_)
    if not obj:
        raise HTTPException(404, f"That {what} no longer exists.")
    return obj


def _late_cutoff() -> datetime:
    return datetime.now(UTC) - timedelta(days=1)


def _sum(db: Session, *where) -> tuple[int, int]:
    total, count = db.execute(select(func.coalesce(func.sum(Charge.amountCents), 0), func.count()).where(*where)).one()
    return int(total), int(count)


def _resident_brief(r: Resident) -> dict:
    return {"id": r.id, "name": r.name, "email": r.email}


# ───── Dashboard ─────

@router.get("/config")
def config():
    s = get_settings()
    return {"stripeEnabled": s.stripe_enabled, "canUploadPhotos": s.can_upload_photos, "siteUrl": site_url()}


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    """The sidebar badges: new requests, overdue charges, and each bed's state."""
    return {
        "newRequests": db.scalar(select(func.count()).select_from(Request).where(Request.status == "NEW")),
        "overdue": db.scalar(select(func.count()).select_from(Charge).where(Charge.status == "DUE", Charge.dueDate < _late_cutoff())),
        "beds": [b["state"] for b in get_beds(db)],
        "unreadNotifications": unread_count(db),
        "failedEmails": failed_count(db),
        "openRepairs": db.scalar(select(func.count()).select_from(RepairRequest).where(RepairRequest.status != "DONE")),
    }


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    active = db.scalars(
        select(Request).where(Request.status.in_(ACTIVE_STATUSES)).options(selectinload(Request.room)).order_by(Request.createdAt.desc())
    ).all()
    due = db.scalars(select(Charge).where(Charge.status == "DUE").options(selectinload(Charge.resident)).order_by(Charge.dueDate)).all()
    collected, _ = _sum(db, Charge.status == "PAID", Charge.paidAt >= month_start(now()))
    return {
        "beds": get_beds(db),
        "houses": get_houses(db),
        "requests": [row(r, room=row(r.room)) for r in active],
        "due": [row(c, resident=row(c.resident)) for c in due],
        "collectedThisMonthCents": collected,
    }


@router.get("/beds")
def beds(db: Session = Depends(get_db)):
    return get_beds(db)


# ───── Requests ─────

@router.get("/requests")
def list_requests(db: Session = Depends(get_db)):
    reqs = db.scalars(select(Request).options(selectinload(Request.room)).order_by(Request.createdAt.desc())).all()
    return [row(r, room=row(r.room)) for r in reqs]


@router.get("/requests/{request_id}")
def get_request(request_id: str, db: Session = Depends(get_db)):
    r = _get(db, Request, request_id, "request")
    return row(r, room=row(r.room), resident=row(r.resident))


class RequestPatch(BaseModel):
    status: str | None = None
    ownerNotes: str | None = Field(default=None, max_length=5000)


@router.patch("/requests/{request_id}")
def update_request(request_id: str, body: RequestPatch, db: Session = Depends(get_db)):
    r = _get(db, Request, request_id, "request")
    if body.status is not None:
        if body.status not in STATUSES:
            raise HTTPException(400, "Unknown status.")
        r.status = body.status
    if body.ownerNotes is not None:
        r.ownerNotes = body.ownerNotes
    db.commit()
    return row(r)


class MoveInIn(BaseModel):
    bedId: str = ""
    moveInDate: str = ""
    rentCents: int = 0
    depositCents: int = 0


@router.post("/requests/{request_id}/move-in", status_code=201)
def move_in(request_id: str, body: MoveInIn, db: Session = Depends(get_db)):
    """Approve → move in: creates the resident, assigns the bed, and bills deposit + first month."""
    req = _get(db, Request, request_id, "request")
    if req.resident:
        return {"residentId": req.resident.id, "existing": True}
    bed = db.get(Bed, body.bedId) if body.bedId else None
    if not bed:
        raise HTTPException(400, "Choose a bed.")
    if bed.resident and bed.resident.active:
        raise HTTPException(409, f"{bed.resident.name} still lives in {bed.label}. Move them out first, then try again.")
    date = parse_day(body.moveInDate)
    if not date:
        raise HTTPException(400, "Choose a move-in date.")
    if body.rentCents <= 0:
        raise HTTPException(400, "Enter the monthly rent.")
    if body.depositCents < 0:
        raise HTTPException(400, "The deposit can't be less than zero.")

    if bed.resident:  # a past resident still linked to the bed
        bed.resident.bedId = None
        db.flush()
    resident = Resident(
        name=req.name, email=req.email, phone=req.phone, bedId=bed.id, requestId=req.id,
        moveInDate=date, rentCents=body.rentCents, portalToken=secrets.token_urlsafe(18),
    )
    db.add(resident)
    db.flush()
    bed.availableFrom = None
    if body.depositCents > 0:
        db.add(Charge(residentId=resident.id, label="Security deposit", amountCents=body.depositCents, dueDate=date))
    db.add(Charge(residentId=resident.id, label=f"{month_label(date)} rent", period=period(date), amountCents=body.rentCents, dueDate=date))
    req.status = "MOVED_IN"
    if req.email:
        notify.email(
            db, req.email,
            "Welcome home — your resident portal",
            f"Hi {first_name(req.name)},\n\nYour room is ready: {bed.room.name}, {bed.label}.\n"
            f"You can pay your deposit and first month ({money(body.depositCents + body.rentCents)}) here:\n"
            f"{site_url()}/portal/{resident.portalToken}\n\nBookmark that link — it's where you'll pay rent each month.",
            "resident.welcome",
        )
    db.commit()  # the move-in and the welcome email are saved together
    return {"residentId": resident.id, "existing": False}


# ───── Rooms & beds ─────

@router.get("/rooms")
def list_rooms(db: Session = Depends(get_db)):
    return get_rooms_with_beds(db)


@router.get("/rooms/{room_id}")
def get_room(room_id: str, db: Session = Depends(get_db)):
    room = _get(db, Room, room_id, "room")
    return row(room, house=house_brief(room.house), beds=[row(b, resident=row(b.resident)) for b in sorted_beds(list(room.beds))])


Kind = Literal["PRIVATE", "SHARED"]
Floor = Literal["Ground", "Upper"]
Bath = Literal["Private", "Shared"]


class RoomPatch(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    summary: str = Field(max_length=500)
    description: str = Field(max_length=5000)
    rentCents: int = Field(ge=0)
    depositCents: int = Field(ge=0)
    features: list[str] = []
    # left out by older forms; only changed when sent
    kind: Kind | None = None
    floor: Floor | None = None
    bathroom: Bath | None = None
    hidden: bool | None = None
    houseId: str | None = None


@router.put("/rooms/{room_id}")
def update_room(room_id: str, body: RoomPatch, db: Session = Depends(get_db)):
    room = _get(db, Room, room_id, "room")
    if body.kind == "PRIVATE" and len(room.beds) > 1:
        raise HTTPException(400, "A private room has one bed. Remove the extra beds first.")
    room.name, room.summary, room.description = body.name.strip(), body.summary, body.description
    room.rentCents, room.depositCents = body.rentCents, body.depositCents
    room.features = json.dumps([f.strip() for f in body.features if f.strip()])
    for k in ("kind", "floor", "bathroom", "hidden"):
        if getattr(body, k) is not None:
            setattr(room, k, getattr(body, k))
    if body.houseId and body.houseId != room.houseId:
        _get(db, House, body.houseId, "house")
        room.houseId = body.houseId
        db.flush()
        # bed numbers run per house, so beds that move take the next free numbers in their new house
        moving = sorted_beds(list(room.beds))
        for b in moving:
            b.label = ""
        db.flush()
        for b in moving:
            b.label = _next_bed_label(db, body.houseId)
            db.flush()
    db.commit()
    if body.hidden is False:
        waitlist.announce(db)
    return row(room)


def _slug(db: Session, name: str) -> str:
    return make_slug(db, name, Room, "room")


def _next_bed_label(db: Session, house_id: str | None) -> str:
    """Bed numbers run across each house (Bed 1, Bed 2…), so a new bed takes its house's next free number."""
    labels = db.scalars(select(Bed.label).join(Bed.room).where(Room.houseId == house_id))
    used = {int(m.group(1)) for label in labels if (m := re.fullmatch(r"Bed (\d+)", label))}
    n = 1
    while n in used:
        n += 1
    return f"Bed {n}"


class RoomIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: Kind
    floor: Floor
    bathroom: Bath
    rentCents: int = Field(ge=0)
    depositCents: int = Field(ge=0)
    beds: int = Field(ge=1, le=12)
    houseId: str | None = None  # left out: the first house
    hidden: bool = True  # new rooms start hidden so they can be finished before anyone sees them


@router.post("/rooms", status_code=201)
def create_room(body: RoomIn, db: Session = Depends(get_db)):
    name = body.name.strip()
    if body.kind == "PRIVATE" and body.beds != 1:
        raise HTTPException(400, "A private room has one bed. Choose shared for more.")
    house_id = body.houseId or first_house_id(db)
    if not house_id:
        raise HTTPException(400, "Add a house first.")
    _get(db, House, house_id, "house")
    last = db.scalar(select(func.max(Room.sortOrder))) or 0
    room = Room(
        houseId=house_id,
        slug=_slug(db, name), name=name, kind=body.kind, floor=body.floor, bathroom=body.bathroom,
        rentCents=body.rentCents, depositCents=body.depositCents, summary="", description="",
        features="[]", photos="[]", tone="oat", sortOrder=last + 1, hidden=body.hidden,
    )
    db.add(room)
    db.flush()
    for _ in range(body.beds):
        db.add(Bed(label=_next_bed_label(db, house_id), roomId=room.id))
        db.flush()
    db.commit()
    return row(room)


def _occupied(beds) -> list[Bed]:
    return [b for b in beds if b.resident and b.resident.active]


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(room_id: str, db: Session = Depends(get_db)):
    room = _get(db, Room, room_id, "room")
    if _occupied(room.beds):
        raise HTTPException(400, "Someone still lives in this room. Move them out or to another bed first.")
    db.delete(room)  # beds go with it; past residents and requests keep their history without the link
    db.commit()


class RoomOrder(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=100)


@router.post("/rooms/order")
def reorder_rooms(body: RoomOrder, db: Session = Depends(get_db)):
    rooms = {r.id: r for r in db.scalars(select(Room))}
    if set(body.ids) != set(rooms):
        raise HTTPException(400, "The room list changed. Reload and try again.")
    for i, rid in enumerate(body.ids, start=1):
        rooms[rid].sortOrder = i
    db.commit()
    return get_rooms_with_beds(db)


class BedIn(BaseModel):
    label: str = Field(default="", max_length=40)


@router.post("/rooms/{room_id}/beds", status_code=201)
def add_bed(room_id: str, body: BedIn, db: Session = Depends(get_db)):
    room = _get(db, Room, room_id, "room")
    if room.kind == "PRIVATE" and room.beds:
        raise HTTPException(400, "A private room has one bed. Change it to shared to add another.")
    if len(room.beds) >= 6:
        raise HTTPException(400, "A room can hold six beds at most.")
    bed = Bed(label=body.label.strip() or _next_bed_label(db, room.houseId), roomId=room.id)
    db.add(bed)
    db.commit()
    waitlist.announce(db)
    return row(bed)


@router.delete("/beds/{bed_id}", status_code=204)
def delete_bed(bed_id: str, db: Session = Depends(get_db)):
    bed = _get(db, Bed, bed_id, "bed")
    if _occupied([bed]):
        raise HTTPException(400, "Someone sleeps in this bed. Move them out first.")
    if len(bed.room.beds) <= 1:
        raise HTTPException(400, "A room needs at least one bed. Delete the room instead.")
    db.delete(bed)
    db.commit()


class BedPatch(BaseModel):
    availableFrom: str | None = None
    label: str | None = Field(default=None, min_length=1, max_length=40)


@router.patch("/beds/{bed_id}")
def update_bed(bed_id: str, body: BedPatch, db: Session = Depends(get_db)):
    bed = _get(db, Bed, bed_id, "bed")
    sent = body.model_fields_set
    if "label" in sent and body.label:
        bed.label = body.label.strip()
    if "availableFrom" in sent or not sent:
        if body.availableFrom:
            day = parse_day(body.availableFrom)
            if not day:
                raise HTTPException(400, "That isn't a date.")
            bed.availableFrom = day
        else:
            bed.availableFrom = None
    db.commit()
    if bed.availableFrom:
        waitlist.announce(db)
    return row(bed)


IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_PHOTO = 8 * 1024 * 1024


def _photos(room: Room) -> list[str]:
    try:
        return json.loads(room.photos)
    except ValueError:
        return []


def _read_photo(photo: UploadFile) -> tuple[str, bytes]:
    ctype = (photo.content_type or "").lower()
    if ctype not in IMAGE_TYPES:
        raise HTTPException(400, "That file isn't a picture. Use a JPG, PNG or WebP.")
    data = photo.file.read(MAX_PHOTO + 1)
    if not data:
        raise HTTPException(400, "Choose a photo first.")
    if len(data) > MAX_PHOTO:
        raise HTTPException(400, "That photo is over 8 MB. Use a smaller one.")
    return ctype, data


@router.post("/rooms/{room_id}/photos", status_code=201)
def upload_photo(room_id: str, photo: UploadFile = File(...), db: Session = Depends(get_db)):
    room = _get(db, Room, room_id, "room")
    if not get_settings().can_upload_photos:
        raise HTTPException(400, "Photo uploads aren't set up on this server yet.")
    ctype, data = _read_photo(photo)
    ext = IMAGE_TYPES.get(ctype, "jpg")
    try:
        url = save_photo(f"{room.id}-{int(time.time() * 1000)}.{ext}", data, ctype)
    except Exception:
        log.exception("Photo upload failed")
        raise HTTPException(502, "The photo couldn't be saved. Try again in a minute.") from None
    room.photos = json.dumps([*_photos(room), url])
    db.commit()
    return {"photos": _photos(room)}


class PhotoRef(BaseModel):
    src: str


@router.post("/rooms/{room_id}/photos/remove")
def remove_photo(room_id: str, body: PhotoRef, db: Session = Depends(get_db)):
    room = _get(db, Room, room_id, "room")
    room.photos = json.dumps([p for p in _photos(room) if p != body.src])
    db.commit()
    return {"photos": _photos(room)}



@router.post("/rooms/{room_id}/photos/cover")
def cover_photo(room_id: str, body: PhotoRef, db: Session = Depends(get_db)):
    """Moves one photo to the front: the room card on the site shows the first."""
    room = _get(db, Room, room_id, "room")
    photos = _photos(room)
    if body.src not in photos:
        raise HTTPException(404, "That photo isn't on this room any more.")
    room.photos = json.dumps([body.src, *[p for p in photos if p != body.src]])
    db.commit()
    return {"photos": _photos(room)}

# ───── Houses ─────

@router.get("/houses")
def list_houses(db: Session = Depends(get_db)):
    return get_houses(db)


class HouseIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    address: str = Field(default="", max_length=200)
    town: str = Field(default="", max_length=80)
    summary: str = Field(default="", max_length=600)
    hidden: bool = False


@router.post("/houses", status_code=201)
def create_house(body: HouseIn, db: Session = Depends(get_db)):
    name = body.name.strip()
    house = House(
        slug=make_slug(db, name), name=name, address=body.address.strip(), town=body.town.strip(),
        summary=body.summary.strip(), hidden=body.hidden, sortOrder=next_sort(db),
    )
    db.add(house)
    db.commit()
    return row(house)


@router.put("/houses/{house_id}")
def update_house(house_id: str, body: HouseIn, db: Session = Depends(get_db)):
    house = _get(db, House, house_id, "house")
    house.name, house.address, house.town = body.name.strip(), body.address.strip(), body.town.strip()
    house.summary, house.hidden = body.summary.strip(), body.hidden
    db.commit()
    if not body.hidden:
        waitlist.announce(db)
    return row(house)


@router.delete("/houses/{house_id}", status_code=204)
def delete_house(house_id: str, db: Session = Depends(get_db)):
    house = _get(db, House, house_id, "house")
    if house.rooms:
        raise HTTPException(400, "This house still has rooms. Move them to another house or delete them first.")
    if db.scalar(select(func.count()).select_from(House)) <= 1:
        raise HTTPException(400, "Keep at least one house.")
    db.delete(house)
    db.commit()


class HouseOrder(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=50)


@router.post("/houses/order")
def reorder_houses(body: HouseOrder, db: Session = Depends(get_db)):
    houses = {h.id: h for h in db.scalars(select(House))}
    if set(body.ids) != set(houses):
        raise HTTPException(400, "The house list changed. Reload and try again.")
    for i, hid in enumerate(body.ids, start=1):
        houses[hid].sortOrder = i
    db.commit()
    return get_houses(db)


# ───── Residents ─────

@router.get("/residents")
def list_residents(db: Session = Depends(get_db)):
    rs = db.scalars(
        select(Resident)
        .options(selectinload(Resident.bed).selectinload(Bed.room), selectinload(Resident.charges))
        .order_by(Resident.active.desc(), Resident.moveInDate.desc())
    ).all()
    return [
        row(r, bed=row(r.bed, room=row(r.bed.room)) if r.bed else None, charges=rows(c for c in r.charges if c.status == "DUE"))
        for r in rs
    ]


@router.get("/residents/{resident_id}")
def get_resident(resident_id: str, db: Session = Depends(get_db)):
    r = _get(db, Resident, resident_id, "resident")
    charges = sorted(r.charges, key=lambda c: c.dueDate, reverse=True)
    return row(r, bed=row(r.bed, room=row(r.bed.room)) if r.bed else None, charges=rows(charges), request=row(r.request))


class ResidentPatch(BaseModel):
    name: str = ""
    phone: str = ""
    email: str = ""
    rentCents: int = 0


@router.patch("/residents/{resident_id}")
def update_resident(resident_id: str, body: ResidentPatch, db: Session = Depends(get_db)):
    r = _get(db, Resident, resident_id, "resident")
    name, phone, email = body.name.strip(), body.phone.strip(), body.email.strip().lower()
    if not name:
        raise HTTPException(400, "Enter their name.")
    if email and ("@" not in email or "." not in email.split("@")[-1] or " " in email):
        raise HTTPException(400, "That email doesn't look right.")
    if body.rentCents <= 0:
        raise HTTPException(400, "Enter the monthly rent.")
    r.name, r.phone, r.email, r.rentCents = name[:120], phone[:40] or None, email or None, body.rentCents
    db.commit()
    return row(r)


@router.post("/residents/{resident_id}/move-out")
def move_out(resident_id: str, db: Session = Depends(get_db)):
    r = _get(db, Resident, resident_id, "resident")
    r.active, r.moveOutDate, r.bedId = False, now(), None
    db.commit()
    waitlist.announce(db)
    return row(r)


class ChargeIn(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    amountCents: int = Field(gt=0)
    dueDate: str


@router.post("/residents/{resident_id}/charges", status_code=201)
def add_charge(resident_id: str, body: ChargeIn, db: Session = Depends(get_db)):
    _get(db, Resident, resident_id, "resident")
    due = parse_day(body.dueDate)
    if not due:
        raise HTTPException(400, "Choose a due date.")
    c = Charge(residentId=resident_id, label=body.label.strip(), amountCents=body.amountCents, dueDate=due)
    db.add(c)
    db.commit()
    return row(c)


@router.post("/residents/{resident_id}/send-link")
def send_pay_link(resident_id: str, db: Session = Depends(get_db)):
    """Emails the resident what they owe and their pay link."""
    r = _get(db, Resident, resident_id, "resident")
    if not r.email:
        raise HTTPException(400, "No email on file. Text them the link instead.")
    due = sorted((c for c in r.charges if c.status == "DUE"), key=lambda c: c.dueDate)
    owed = sum(c.amountCents for c in due)
    link = f"{site_url()}/portal/{r.portalToken}"
    if owed:
        items = "\n".join(f"• {c.label}: {money(c.amountCents)}" for c in due)
        subject = f"You have {money(owed)} to pay at Respite for the Weary"
        text = f"Hi {first_name(r.name)},\n\nHere is what is waiting to be paid:\n{items}\n\nTotal: {money(owed)}\nPay here: {link}\n\nIf you already paid in person, you can ignore this."
    else:
        subject = "Your Respite for the Weary pay link"
        text = f"Hi {first_name(r.name)},\n\nYou're paid up. This is the link where you'll pay rent each month:\n{link}"
    notify.email(db, r.email, subject, text, "resident.pay_link")
    db.commit()
    return {"ok": f"Sent to {r.email}"}


@router.post("/residents/{resident_id}/new-link")
def replace_pay_link(resident_id: str, db: Session = Depends(get_db), user: AdminUser = Depends(owner_only)):
    """Gives the resident a new pay link and stops the old one working, for when a link was shared or lost. Owners only."""
    r = _get(db, Resident, resident_id, "resident")
    r.portalToken = secrets.token_urlsafe(18)
    link = f"{site_url()}/portal/{r.portalToken}"
    if r.email:
        notify.email(
            db, r.email, "Your new Respite for the Weary pay link",
            f"Hi {first_name(r.name)},\n\nWe've given you a new pay link. The old one no longer works, so please use this one from now on:\n{link}\n\n"
            "Your balance, payments and autopay are just as they were. If you didn't expect this, call the house.",
            "resident.pay_link",
        )
    notify.owner(
        db, "resident.pay_link", f"New pay link for {r.name}",
        f"{user.name or user.email} replaced it. The old link no longer works." + ("" if r.email else " There's no email on file, so text them the new one."),
        f"/admin/residents/{r.id}", send_email=False,
    )
    db.commit()
    return {"ok": f"New link made{f' and sent to {r.email}' if r.email else ''}. The old one no longer works."}


# ───── Charges & billing ─────

@router.get("/charges")
def list_charges(tab: Literal["due", "paid", "all"] = Query("due"), db: Session = Depends(get_db)):
    q = select(Charge).options(selectinload(Charge.resident)).limit(200)
    if tab == "paid":
        q = q.where(Charge.status.in_(("PAID", "REFUNDED"))).order_by(Charge.paidAt.desc())
    elif tab == "all":
        q = q.order_by(Charge.dueDate.desc())
    else:
        q = q.where(Charge.status == "DUE").order_by(Charge.dueDate)
    due_total, due_count = _sum(db, Charge.status == "DUE")
    late_total, late_count = _sum(db, Charge.status == "DUE", Charge.dueDate < _late_cutoff())
    collected, _ = _sum(db, Charge.status == "PAID", Charge.paidAt >= month_start(now()))
    return {
        "charges": [row(c, resident=_resident_brief(c.resident)) for c in db.scalars(q)],
        "due": {"totalCents": due_total, "count": due_count},
        "late": {"totalCents": late_total, "count": late_count},
        "collectedThisMonthCents": collected,
        "activeResidents": db.scalar(select(func.count()).select_from(Resident).where(Resident.active.is_(True))),
    }


class PaymentIn(BaseModel):
    method: str = "CASH"
    amountCents: int | None = Field(default=None, ge=1)  # less than the charge records part of it


@router.post("/charges/{charge_id}/pay")
def record_payment(charge_id: str, body: PaymentIn, db: Session = Depends(get_db)):
    c = _get(db, Charge, charge_id, "charge")
    if body.method not in PAY_METHODS:
        raise HTTPException(400, "Unknown payment method.")
    if c.status != "DUE":
        raise HTTPException(409, "This charge isn't waiting to be paid.")
    if body.amountCents and body.amountCents > c.amountCents:
        raise HTTPException(400, f"That's more than the {money(c.amountCents)} owed.")
    part = body.amountCents if body.amountCents and body.amountCents < c.amountCents else None
    ids = apply_plan(db, [(c.id, part)], body.method)
    paid = db.get(Charge, ids[0]) if ids else c
    send_receipt(db, paid)
    db.commit()
    return row(paid)


# ───── Billing rules ─────

@router.get("/billing/settings")
def billing_settings(db: Session = Depends(get_db)):
    return get_policy(db).model_dump()


@router.put("/billing/settings", dependencies=[Depends(owner_only)])
def save_billing_settings(body: Policy, db: Session = Depends(get_db)):
    return save_policy(db, body).model_dump()


@router.post("/charges/{charge_id}/void")
def void_charge(charge_id: str, db: Session = Depends(get_db)):
    c = _get(db, Charge, charge_id, "charge")
    if c.status != "DUE":
        raise HTTPException(409, "Only an unpaid charge can be voided. Refund a paid one instead.")
    c.status = "VOID"
    db.commit()
    return row(c)


class RefundIn(BaseModel):
    note: str = Field(default="", max_length=500)


@router.post("/charges/{charge_id}/refund", dependencies=[Depends(owner_only)])
def refund_charge(charge_id: str, body: RefundIn, db: Session = Depends(get_db)):
    """Gives a paid charge back in full. Online payments go back through Stripe. Owners only: this moves money."""
    c = db.scalar(select(Charge).where(Charge.id == charge_id).options(selectinload(Charge.resident)))
    if not c:
        raise HTTPException(404, "We couldn't find that charge.")
    return refund(db, c, body.note.strip())


class BillIn(BaseModel):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")


@router.post("/billing/run")
def bill_month(body: BillIn, db: Session = Depends(get_db)):
    """Creates a month's rent for every active resident (skips anyone already billed)."""
    y, m = map(int, body.month.split("-"))
    if not 1 <= m <= 12:
        raise HTTPException(400, "Choose a month.")
    return {"billed": bill_rent(db, datetime(y, m, 1, tzinfo=UTC))}


# ───── Website: wording, FAQ, house details, homepage photos ─────

@router.get("/content")
def get_content(db: Session = Depends(get_db)):
    return {**content.get_all(db), "defaults": content.DEFAULTS}


@router.put("/content/{key}")
def save_content(key: Literal["house", "home", "who", "faq"], body: dict, db: Session = Depends(get_db)):
    try:
        data = content.SCHEMAS[key].model_validate(body)
    except ValidationError as e:
        err = e.errors()[0]
        where = " › ".join(str(p) for p in err["loc"])
        raise HTTPException(400, f"Check {where}: {err['msg'].removeprefix('Value error, ')}") from None
    return content.save_section(db, key, data)


@router.post("/content/{key}/reset")
def reset_content(key: Literal["house", "home", "who", "faq"], db: Session = Depends(get_db)):
    return content.reset_section(db, key)


@router.post("/content/photo", status_code=201)
def upload_site_photo(photo: UploadFile = File(...)):
    """Saves a picture for the homepage and returns its address; the page form then stores it on its slot."""
    if not get_settings().can_upload_photos:
        raise HTTPException(400, "Photo uploads aren't set up on this server yet.")
    ctype, data = _read_photo(photo)
    try:
        url = save_photo(f"site-{int(time.time() * 1000)}-{secrets.token_hex(3)}.{IMAGE_TYPES.get(ctype, 'jpg')}", data, ctype)
    except Exception:
        log.exception("Photo upload failed")
        raise HTTPException(502, "The photo couldn't be saved. Try again in a minute.") from None
    return {"src": url}


# ───── Tours ─────

@router.get("/tours/settings")
def tour_settings(db: Session = Depends(get_db)):
    return tours.get_settings(db).model_dump()


@router.put("/tours/settings")
def save_tour_settings(body: dict, db: Session = Depends(get_db)):
    try:
        s = tours.Settings.model_validate(body)
    except (ValidationError, ValueError):
        raise HTTPException(400, "Check the times and dates. Times look like 14:30, dates like 2026-12-25.")
    return tours.save_settings(db, s).model_dump()


def _tour_row(t: Tour) -> dict:
    return row(t, when=tours.when(t.date, t.time), startsAt=tours.starts_at(t.date, t.time).isoformat())


@router.get("/tours")
def list_tours(
    when: Literal["upcoming", "past", "month"] = Query("upcoming"),
    month: str = Query("", pattern=r"^(\d{4}-(0[1-9]|1[0-2]))?$"),
    db: Session = Depends(get_db),
):
    today = tours.local_now().date().isoformat()
    q = select(Tour)
    if when == "month":
        m = month or today[:7]
        q = q.where(Tour.date >= f"{m}-01", Tour.date <= f"{m}-31", Tour.status != "CANCELLED").order_by(Tour.date, Tour.time)
    elif when == "upcoming":
        q = q.where(Tour.date >= today, Tour.status == "BOOKED").order_by(Tour.date, Tour.time)
    else:
        q = q.where((Tour.date < today) | (Tour.status != "BOOKED")).order_by(Tour.date.desc(), Tour.time.desc()).limit(100)
    return [_tour_row(t) for t in db.scalars(q).all()]


class TourPatch(BaseModel):
    status: Literal["BOOKED", "DONE", "NO_SHOW", "CANCELLED"]


@router.patch("/tours/{tour_id}")
def update_tour(tour_id: str, body: TourPatch, db: Session = Depends(get_db)):
    t = _get(db, Tour, tour_id, "tour")
    if body.status == t.status:
        return _tour_row(t)
    if body.status == "BOOKED" and db.scalar(select(Tour).where(Tour.date == t.date, Tour.time == t.time, Tour.status == "BOOKED")):
        raise HTTPException(409, "Someone else has that time now.")
    if body.status == "CANCELLED" and t.status == "BOOKED":
        t.cancelledBy = "HOUSE"
        tours.email_cancelled_by_house(db, t)
    t.status = body.status
    db.commit()
    return _tour_row(t)


class TourByHouse(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    name: str = Field(min_length=2, max_length=200)
    phone: str = Field(min_length=7, max_length=60)
    email: str | None = Field(default=None, max_length=200)
    note: str = Field(default="", max_length=1000)


@router.post("/tours", status_code=201)
def book_for_caller(body: TourByHouse, db: Session = Depends(get_db)):
    """For someone who called. Any time works here, not just the weekly ones; it still can't double book."""
    if parse_day(body.date) is None:
        raise HTTPException(400, "That isn't a date.")
    if db.scalar(select(Tour).where(Tour.date == body.date, Tour.time == body.time, Tour.status == "BOOKED")):
        raise HTTPException(409, "There's already a tour at that time.")
    email = (body.email or "").strip() or None
    t = Tour(
        date=body.date, time=body.time, name=body.name.strip(), phone=body.phone.strip(), email=email,
        note=body.note.strip(), bookedBy="HOUSE", token=tours.new_token(),
    )
    db.add(t)
    tours.email_booked(db, t)
    db.commit()
    return _tour_row(t)


# ───── Waitlist ─────

@router.get("/waitlist")
def list_waitlist(db: Session = Depends(get_db)):
    q = select(WaitlistEntry).options(selectinload(WaitlistEntry.room)).where(WaitlistEntry.status != "REMOVED").order_by(WaitlistEntry.createdAt)
    return [row(w, roomName=w.room.name if w.room else None) for w in db.scalars(q).all()]


class WaitlistPatch(BaseModel):
    status: Literal["WAITING", "NOTIFIED", "REMOVED"]


@router.patch("/waitlist/{entry_id}")
def update_waitlist(entry_id: str, body: WaitlistPatch, db: Session = Depends(get_db)):
    w = _get(db, WaitlistEntry, entry_id, "waitlist entry")
    w.status = body.status
    if body.status == "WAITING":
        w.notifiedAt = None
    db.commit()
    return row(w)
