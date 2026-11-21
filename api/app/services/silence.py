"""Property videos have no sound. Videos uploaded before that rule get their sound taken off here,
once, when the API starts. A video counts as done when its address carries the SILENT mark
(new uploads are named with it) or Cloudinary's ac_none, so nothing is done twice."""

import json
import logging
import re
import time

import httpx
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import House, Room
from .storage import NO_SOUND, SILENT, _sign, save_photo, strip_audio

log = logging.getLogger("respite.silence")

# https://res.cloudinary.com/<cloud>/video/upload/v123/<folder>/<name>.<ext>
_CLOUDINARY = re.compile(r"^(https://res\.cloudinary\.com/([^/]+)/video/upload/)(?:v\d+/)?(.+)\.\w+$")
_EXT = {"mp4", "mov", "webm"}


def is_silent(src: str) -> bool:
    return f"/{NO_SOUND}/" in src or SILENT in src


def _silent_cloudinary(src: str) -> str | None:
    """Cloudinary keeps the original; asking for the ac_none copy gives the same video without sound.
    The copy is made ahead of time (long videos can't be made while someone waits), then the address points at it."""
    m = _CLOUDINARY.match(src)
    if not m:
        return None
    base, cloud, public_id = m.groups()
    creds = get_settings().cloudinary
    if creds and creds[2] == cloud:
        key, secret, _ = creds
        params = {"public_id": public_id, "type": "upload", "eager": NO_SOUND, "eager_async": "true", "timestamp": str(int(time.time()))}
        try:
            httpx.post(
                f"https://api.cloudinary.com/v1_1/{cloud}/video/explicit",
                data={**params, "api_key": key, "signature": _sign(params, secret)},
                timeout=60,
            ).raise_for_status()
        except Exception:
            log.exception("Cloudinary couldn't start the silent copy of %s", src)
            return None
    return base + NO_SOUND + "/" + src.removeprefix(base)


def _silent_file(src: str, owner_id: str) -> str | None:
    """Videos saved on Vercel Blob or this server's disk: fetch, take the sound off, save again."""
    ext = src.rsplit(".", 1)[-1].lower()
    if ext not in _EXT:
        return None
    s = get_settings()
    if src.startswith(s.upload_url_prefix.rstrip("/") + "/"):
        path = s.upload_dir / src.rsplit("/", 1)[-1]
        if not path.is_file():
            return None
        data = path.read_bytes()
    elif src.startswith("https://"):
        r = httpx.get(src, timeout=120, follow_redirects=True)
        r.raise_for_status()
        data = r.content
    else:
        return None
    ctype = {"mp4": "video/mp4", "mov": "video/quicktime", "webm": "video/webm"}[ext]
    return save_photo(f"video-{owner_id}-{int(time.time() * 1000)}{SILENT}.{ext}", strip_audio(data, ext), ctype)


def silence_old_videos(db: Session) -> int:
    """Takes the sound off every saved video that still has it. Returns how many were changed.
    One video failing (gone, unreadable) leaves it as it is and moves on to the next."""
    changed = 0
    for thing in [*db.query(House).all(), *db.query(Room).all()]:
        try:
            videos = json.loads(thing.videos or "[]")
        except ValueError:
            continue
        out = []
        for src in videos:
            new = None
            if not is_silent(src):
                try:
                    new = _silent_cloudinary(src) if src.startswith("https://res.cloudinary.com/") else _silent_file(src, thing.id)
                except Exception:
                    log.exception("Couldn't take the sound off %s", src)
            out.append(new or src)
            changed += bool(new)
        if out != videos:
            thing.videos = json.dumps(out)
            db.commit()
    if changed:
        log.warning("Took the sound off %d older video(s)", changed)
    return changed
