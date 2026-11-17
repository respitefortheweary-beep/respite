"""Houses: each property the owners run. Rooms belong to one house."""

import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import House, Room
from .content import get_section


def make_slug(db: Session, name: str, model=House, fallback: str = "house") -> str:
    base = re.sub(r"[^a-z0-9]+", "-", re.sub(r"^the\s+", "", name.lower())).strip("-") or fallback
    slug, n = base[:60], 2
    while db.scalar(select(model.id).where(model.slug == slug)):
        slug, n = f"{base[:56]}-{n}", n + 1
    return slug


def ensure_houses(db: Session) -> None:
    """Databases from before houses existed: make the first house from the site's address,
    and put every room that has no house into the first one."""
    first = db.scalar(select(House).order_by(House.sortOrder, House.createdAt))
    if not first:
        info = get_section(db, "house")
        town = info["town"].split(",")[0].strip()
        name = f"The {town} House" if town else "The House"
        first = House(slug=make_slug(db, name), name=name, address=info["address"], town=info["town"], sortOrder=1)
        db.add(first)
        db.flush()
    orphans = db.scalars(select(Room).where(Room.houseId.is_(None))).all()
    for r in orphans:
        r.houseId = first.id
    db.commit()


def first_house_id(db: Session) -> str | None:
    return db.scalar(select(House.id).order_by(House.sortOrder, House.createdAt))


def house_brief(h: House | None, public: bool = False) -> dict | None:
    """The house a room belongs to. The public site only gets the town: the street address is shared at a tour."""
    if not h:
        return None
    return {"id": h.id, "slug": h.slug, "name": h.name, "town": h.town, "address": "" if public else h.address, "hidden": h.hidden}


def next_sort(db: Session) -> int:
    return (db.scalar(select(func.max(House.sortOrder))) or 0) + 1
