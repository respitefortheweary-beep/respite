import re
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Bed, House, Room
from ..serialize import iso, row
from .houses import house_brief


def bed_state(bed: Bed) -> str:
    """open: nobody lives there · soon: someone is leaving on availableFrom · taken."""
    if not bed.resident or not bed.resident.active:
        return "open"
    if bed.availableFrom and bed.availableFrom > datetime.now(UTC):
        return "soon"
    if bed.availableFrom:
        return "open"
    return "taken"


def _natural(label: str):
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", label)]


def sorted_beds(beds: list[Bed]) -> list[Bed]:
    return sorted(beds, key=lambda b: _natural(b.label))


def get_beds(db: Session, public: bool = False) -> list[dict]:
    q = (
        select(Bed)
        .join(Bed.room)
        .outerjoin(Room.house)
        .options(selectinload(Bed.room).selectinload(Room.house), selectinload(Bed.resident))
    )
    if public:
        q = q.where(Room.hidden.is_(False), House.hidden.is_not(True))
    beds = db.scalars(q).all()
    return [
        {
            "id": b.id,
            "label": b.label,
            "roomSlug": b.room.slug,
            "roomName": b.room.name,
            "houseId": b.room.houseId,
            "houseName": b.room.house.name if b.room.house else "",
            "state": bed_state(b),
            "availableFrom": iso(b.availableFrom),
            "residentName": b.resident.name if b.resident and b.resident.active else None,
        }
        for b in sorted(beds, key=lambda b: (_house_order(b.room), b.room.sortOrder, _natural(b.label)))
    ]


def _house_order(room: Room) -> tuple:
    h = room.house
    return (h.sortOrder, h.createdAt) if h else (0, room.createdAt)


def get_rooms_with_beds(db: Session, public: bool = False) -> list[dict]:
    q = (
        select(Room)
        .outerjoin(Room.house)
        .options(selectinload(Room.beds).selectinload(Bed.resident), selectinload(Room.house))
        .order_by(House.sortOrder, House.createdAt, Room.sortOrder, Room.createdAt)
    )
    if public:
        q = q.where(Room.hidden.is_(False), House.hidden.is_not(True))
    rooms = db.scalars(q).all()
    out = []
    for r in rooms:
        beds = sorted_beds(list(r.beds))
        states = [{"label": b.label, "state": bed_state(b), "availableFrom": b.availableFrom} for b in beds]
        soon = sorted(s["availableFrom"] for s in states if s["state"] == "soon")
        out.append(
            row(
                r,
                house=house_brief(r.house, public),
                beds=[row(b) for b in beds],
                states=[{**s, "availableFrom": iso(s["availableFrom"])} for s in states],
                open=sum(s["state"] == "open" for s in states),
                soon=iso(soon[0]) if soon else None,
            )
        )
    return out


def get_houses(db: Session, public: bool = False) -> list[dict]:
    """Every house with its rooms' bed states in order, for the dashboard and the public site."""
    q = select(House).order_by(House.sortOrder, House.createdAt)
    if public:
        q = q.where(House.hidden.is_(False))
    houses = db.scalars(q).all()
    rooms = get_rooms_with_beds(db, public=public)
    out = []
    for h in houses:
        mine = [r for r in rooms if r["houseId"] == h.id]
        states = [s for r in mine for s in r["states"]]
        out.append(
            row(
                h,
                **({"address": ""} if public else {}),
                rooms=len(mine),
                beds=len(states),
                open=sum(s["state"] == "open" for s in states),
                states=[s["state"] for s in states],
                labels=[s["label"] for s in states],
            )
        )
    return out
