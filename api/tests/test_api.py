import os
import subprocess
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp())
os.environ.update(
    DATABASE_URL=f"sqlite:///{(_tmp / 'test.db').as_posix()}",
    JWT_SECRET="test-secret-that-is-at-least-32-bytes-long",
    ADMIN_EMAIL="owner@example.com",
    ADMIN_PASSWORD="correct-horse-battery",
    OWNER_EMAIL="owner@example.com",
    UPLOAD_DIR=str(_tmp / "uploads"),
    CRON_SECRET="cron-test",
    STRIPE_SECRET_KEY="",
    RESEND_API_KEY="",
    CLOUDINARY_URL="",  # never upload to the real Cloudinary from tests
    CLOUDINARY_CLOUD_NAME="",
    CLOUDINARY_API_KEY="",
    CLOUDINARY_API_SECRET="",
    NOTIFY_WORKER="false",  # tests send the outbox by hand
)

import imageio_ffmpeg  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import SessionLocal, now  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Notification  # noqa: E402
from app.services import notify  # noqa: E402
from app.services.email import EmailError  # noqa: E402
from app.seed import seed  # noqa: E402

PW = "correct-horse-battery"


@pytest.fixture(scope="module")
def client():
    seed()
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def auth(client):
    r = client.post("/auth/login", json={"email": "owner@example.com", "password": PW})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['accessToken']}"}


def test_public_rooms_and_beds(client, auth):
    rooms = client.get("/public/rooms").json()
    assert [r["slug"] for r in rooms] == ["porch-room", "garden-room", "maple-room", "dogwood-room"]
    maple = rooms[2]
    assert [s["state"] for s in maple["states"]] == ["soon", "open"]
    assert maple["soon"].startswith("2026-12-15T00:00:00")
    beds = client.get("/public/beds").json()
    assert len(beds) == 6 and {b["state"] for b in beds} <= {"open", "soon", "taken"}
    assert all("residentName" not in b for b in beds)
    assert "residentName" in client.get("/admin/beds", headers=auth).json()[0]


def test_admin_needs_login(client):
    assert client.get("/admin/overview").status_code == 401
    assert client.get("/admin/overview", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_login_rejects_wrong_password(client):
    r = client.post("/auth/login", json={"email": "owner@example.com", "password": "wrong"})
    assert r.status_code == 401
    assert client.post("/auth/login", json={"email": "nobody@example.com", "password": "x"}).status_code == 401


def test_me_and_no_hash_leak(client, auth):
    me = client.get("/auth/me", headers=auth).json()
    assert me["email"] == "owner@example.com"
    assert "passwordHash" not in me and "tokenVersion" not in me


def test_request_without_program(client, auth):
    """Saying which group fits is optional (fair housing): the request goes through without it."""
    r = client.post("/public/requests", json={"forWhom": "SELF", "moveIn": "ASAP", "payment": "UNSURE", "name": "Pat Example", "phone": "804 555 0177"})
    assert r.status_code == 201, r.text
    req = client.get(f"/admin/requests/{r.json()['id']}", headers=auth).json()
    assert not req["program"]


def test_apply_then_move_in_then_pay(client, auth):
    bad = client.post("/public/requests", json={"forWhom": "SELF", "program": "SENIOR", "moveIn": "ASAP", "payment": "VA", "name": "A", "phone": "1234567"})
    assert bad.status_code == 400 and bad.json()["detail"] == "Enter a name"

    r = client.post("/public/requests", json={
        "forWhom": "SELF", "program": "SENIOR", "moveIn": "ASAP", "payment": "VA",
        "name": "Ruth Example", "phone": "804 555 0100", "email": "ruth@example.com", "room": "porch-room",
    })
    assert r.status_code == 201, r.text
    req_id = r.json()["id"]
    assert r.json()["firstName"] == "Ruth"

    porch_bed = next(b for b in client.get("/admin/beds", headers=auth).json() if b["roomSlug"] == "porch-room")
    mi = client.post(f"/admin/requests/{req_id}/move-in", headers=auth,
                     json={"bedId": porch_bed["id"], "moveInDate": "2026-12-01", "rentCents": 87500, "depositCents": 30000})
    assert mi.status_code == 201, mi.text
    rid = mi.json()["residentId"]

    again = client.post(f"/admin/requests/{req_id}/move-in", headers=auth, json={"bedId": porch_bed["id"], "moveInDate": "2026-12-01", "rentCents": 1})
    assert again.json() == {"residentId": rid, "existing": True}

    res = client.get(f"/admin/residents/{rid}", headers=auth).json()
    assert res["bed"]["room"]["slug"] == "porch-room"
    assert sorted(c["amountCents"] for c in res["charges"]) == [30000, 87500]
    token = res["portalToken"]

    portal = client.get(f"/portal/{token}").json()
    assert "portalToken" not in portal and portal["stripeEnabled"] is False
    co = client.post(f"/portal/{token}/checkout", json={"chargeIds": []}).json()
    assert co["url"].startswith(f"/portal/{token}/pay?c=")
    ids = co["url"].split("c=")[1].split(",")
    assert client.post(f"/portal/{token}/demo-pay", json={"chargeIds": ids}).json() == {"paid": 2}
    assert all(c["status"] == "PAID" for c in client.get(f"/portal/{token}").json()["charges"])

    # bed is now taken; another move-in into it is refused
    other = client.post("/public/requests", json={"forWhom": "SELF", "program": "VETERAN", "moveIn": "ASAP", "payment": "VA", "name": "Sam Other", "phone": "804 555 0101"}).json()["id"]
    blocked = client.post(f"/admin/requests/{other}/move-in", headers=auth, json={"bedId": porch_bed["id"], "moveInDate": "2026-12-01", "rentCents": 1000})
    assert blocked.status_code == 409


def test_portal_bad_token(client):
    assert client.get("/portal/not-a-token").status_code == 404


def test_billing_is_idempotent(client, auth):
    first = client.post("/admin/billing/run", headers=auth, json={"month": "2027-01"}).json()["billed"]
    assert first >= 3
    assert client.post("/admin/billing/run", headers=auth, json={"month": "2027-01"}).json()["billed"] == 0
    ch = client.get("/admin/charges?tab=due", headers=auth).json()
    assert ch["due"]["count"] >= first and ch["activeResidents"] >= 3


def test_cron_needs_secret(client):
    assert client.get("/cron/bill-rent").status_code == 401
    assert client.get("/cron/bill-rent", headers={"Authorization": "Bearer cron-test"}).status_code == 200


def _emails(**where):
    with SessionLocal() as db:
        q = db.query(Notification).filter_by(channel="EMAIL", **where)
        return [(n.kind, n.recipient, n.status) for n in q.order_by(Notification.createdAt)]


def test_actions_queue_notifications(client, auth, monkeypatch):
    kinds = {k for k, _, _ in _emails()}
    assert {"request.new", "request.received", "resident.welcome", "payment.received", "rent.billed"} <= kinds
    assert ("request.received", "ruth@example.com", "PENDING") in _emails()

    inbox = client.get("/admin/notifications", headers=auth).json()
    assert {"request.new", "payment.received"} <= {n["kind"] for n in inbox["items"]}
    assert inbox["unread"] == len(inbox["items"]) and all(n["channel"] == "INBOX" for n in inbox["items"])
    assert client.get("/admin/summary", headers=auth).json()["unreadNotifications"] == inbox["unread"]

    sent = []
    monkeypatch.setattr(notify, "deliver", lambda to, subject, text: sent.append((to, subject)))
    assert client.get("/cron/notifications").status_code == 401
    out = client.post("/cron/notifications", headers={"Authorization": "Bearer cron-test"}).json()
    assert out["sent"] == len(sent) > 0
    assert _emails(status="PENDING") == []
    assert ("ruth@example.com", "We got your request — Respite for the Weary") in sent


def test_failed_email_retries_then_alerts_owner(client, auth, monkeypatch):
    def broken(*_):
        raise EmailError("Resend said 500: down")

    monkeypatch.setattr(notify, "deliver", broken)
    assert client.post("/admin/notifications/test", headers=auth).status_code == 200
    with SessionLocal() as db:
        for attempt in range(1, notify.MAX_ATTEMPTS + 1):
            assert notify.deliver_pending(db) == 0
            n = db.query(Notification).filter_by(kind="test").one()
            assert n.attempts == attempt and n.lastError == "Resend said 500: down"
            if attempt < notify.MAX_ATTEMPTS:
                assert n.status == "PENDING" and n.nextAttemptAt > now()
                assert notify.deliver_pending(db) == 0 and n.attempts == attempt  # not due yet
                n.nextAttemptAt = now()
                db.commit()
        assert n.status == "FAILED" and n.nextAttemptAt is None
        alert = db.query(Notification).filter_by(kind="email.failed").one()
        assert alert.channel == "INBOX" and alert.link == "/admin/notifications?tab=email"
        assert db.query(Notification).filter_by(kind="email.failed", channel="EMAIL").count() == 0
        nid = n.id

    box = client.get("/admin/outbox?status=FAILED", headers=auth).json()
    assert box["counts"]["FAILED"] == 1 and box["items"][0]["id"] == nid and "test" in box["kinds"]
    assert client.get("/admin/summary", headers=auth).json()["failedEmails"] == 1

    monkeypatch.setattr(notify, "deliver", lambda *_: None)
    assert client.post(f"/admin/outbox/{nid}/retry", headers=auth).status_code == 200
    with SessionLocal() as db:
        assert notify.deliver_pending(db) == 1
    assert client.post(f"/admin/outbox/{nid}/retry", headers=auth).status_code == 400
    assert client.get("/admin/summary", headers=auth).json()["failedEmails"] == 0


def test_unexpected_send_error_does_not_jam_the_queue(client, auth, monkeypatch):
    def crash(*_):
        raise UnicodeEncodeError("charmap", "x", 0, 1, "nope")

    monkeypatch.setattr(notify, "deliver", crash)
    assert client.post("/admin/notifications/test", headers=auth).status_code == 200
    with SessionLocal() as db:
        assert notify.deliver_pending(db) == 0
        n = db.query(Notification).filter_by(kind="test", status="PENDING").one()
        assert n.attempts == 1 and n.lastError.startswith("UnicodeEncodeError")
        n.status = "SENT"  # tidy up for the tests after this
        db.commit()


def test_mark_notifications_read(client, auth):
    items = client.get("/admin/notifications", headers=auth).json()["items"]
    before = client.get("/admin/notifications", headers=auth).json()["unread"]
    assert client.post("/admin/notifications/read", headers=auth, json={"ids": [items[0]["id"]]}).json()["unread"] == before - 1
    assert client.post("/admin/notifications/read", headers=auth, json={}).json()["unread"] == 0
    assert client.get("/admin/summary", headers=auth).json()["unreadNotifications"] == 0


def test_room_edit_and_photo(client, auth):
    room = client.get("/admin/rooms", headers=auth).json()[0]
    r = client.put(f"/admin/rooms/{room['id']}", headers=auth, json={
        "name": "The Porch Room", "summary": "s", "description": "d", "rentCents": 90000, "depositCents": 30000, "features": ["A", " ", "B"]})
    assert r.status_code == 200 and r.json()["features"] == '["A", "B"]'
    up = client.post(f"/admin/rooms/{room['id']}/photos", headers=auth, files={"photo": ("p.png", b"\x89PNG fake", "image/png")})
    assert up.status_code == 201, up.text
    src = up.json()["photos"][-1]
    assert src.startswith("/uploads/") and (_tmp / "uploads" / src.split("/")[-1]).exists()
    second = client.post(f"/admin/rooms/{room['id']}/photos", headers=auth, files={"photo": ("q.webp", b"RIFF fake", "image/webp")}).json()["photos"][-1]
    assert client.post(f"/admin/rooms/{room['id']}/photos/cover", headers=auth, json={"src": second}).json()["photos"] == [second, src]
    assert client.post(f"/admin/rooms/{room['id']}/photos/cover", headers=auth, json={"src": "/uploads/gone.png"}).status_code == 404
    client.post(f"/admin/rooms/{room['id']}/photos/remove", headers=auth, json={"src": second})
    assert client.post(f"/admin/rooms/{room['id']}/photos/remove", headers=auth, json={"src": src}).json()["photos"] == []
    txt = client.post(f"/admin/rooms/{room['id']}/photos", headers=auth, files={"photo": ("a.txt", b"hi", "text/plain")})
    assert txt.status_code == 400


def test_house_photos(client, auth):
    house = client.get("/admin/houses", headers=auth).json()[0]
    assert house["photos"] == "[]"
    a = client.post(f"/admin/houses/{house['id']}/photos", headers=auth, files={"photo": ("h.png", b"\x89PNG fake", "image/png")})
    assert a.status_code == 201, a.text
    first = a.json()["photos"][-1]
    second = client.post(f"/admin/houses/{house['id']}/photos", headers=auth, files={"photo": ("i.webp", b"RIFF fake", "image/webp")}).json()["photos"][-1]
    assert client.post(f"/admin/houses/{house['id']}/photos/cover", headers=auth, json={"src": second}).json()["photos"] == [second, first]
    client.post(f"/admin/houses/{house['id']}/photos/remove", headers=auth, json={"src": second})
    assert client.post(f"/admin/houses/{house['id']}/photos/remove", headers=auth, json={"src": first}).json()["photos"] == []


def _clip_with_sound() -> bytes:
    """A one-second MP4 with a picture and a tone, made by the same ffmpeg the API uses."""
    out = _tmp / "clip.mp4"
    subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=duration=1:size=64x64:rate=10",
         "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-shortest", str(out)],
        check=True,
    )
    assert "Audio:" in _streams(out)
    return out.read_bytes()


def _streams(path: Path) -> str:
    # ffmpeg -i with no output lists the file's streams on stderr
    return subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr


def test_videos_for_houses_and_rooms(client, auth):
    house = client.get("/admin/houses", headers=auth).json()[0]
    room = client.get("/admin/rooms", headers=auth).json()[0]
    # no Cloudinary in tests: the video comes through the API
    assert client.post(f"/admin/houses/{house['id']}/videos/ticket", headers=auth).json() == {"direct": False}
    up = client.post(f"/admin/rooms/{room['id']}/videos", headers=auth, files={"video": ("t.mp4", _clip_with_sound(), "video/mp4")})
    assert up.status_code == 201, up.text
    src = up.json()["videos"][-1]
    assert src.startswith("/uploads/") and src.endswith(".mp4")
    # the sound track is taken off before saving; the picture stays
    streams = _streams(_tmp / "uploads" / src.removeprefix("/uploads/"))
    assert "Video:" in streams and "Audio:" not in streams
    # something that isn't really a video is turned down instead of saved
    assert client.post(f"/admin/rooms/{room['id']}/videos", headers=auth, files={"video": ("t.mp4", b"fake mp4", "video/mp4")}).status_code == 400
    assert client.post(f"/admin/rooms/{room['id']}/videos", headers=auth, files={"video": ("a.png", b"x", "image/png")}).status_code == 400
    assert client.post(f"/admin/houses/{house['id']}/videos/link", headers=auth, json={"src": "https://evil.example/v.mp4"}).status_code == 400
    cdn = "https://res.cloudinary.com/demo/video/upload/v1/respite/tour.mp4"
    assert client.post(f"/admin/houses/{house['id']}/videos/link", headers=auth, json={"src": cdn}).json()["videos"] == [cdn]
    assert client.post(f"/admin/houses/{house['id']}/videos/remove", headers=auth, json={"src": cdn}).json()["videos"] == []
    assert client.post(f"/admin/rooms/{room['id']}/videos/remove", headers=auth, json={"src": src}).json()["videos"] == []
    assert client.post(f"/admin/beds/x/videos/ticket", headers=auth).status_code == 404


def test_older_videos_lose_their_sound(client, auth):
    import json

    from app.models import House
    from app.services.silence import silence_old_videos

    house = client.get("/admin/houses", headers=auth).json()[0]
    (_tmp / "uploads").mkdir(exist_ok=True)
    (_tmp / "uploads" / "old-tour.mp4").write_bytes(_clip_with_sound())
    cdn = "https://res.cloudinary.com/demo/video/upload/v1/respite/old-tour.mp4"
    with SessionLocal() as db:
        db.get(House, house["id"]).videos = json.dumps(["/uploads/old-tour.mp4", cdn])
        db.commit()
        assert silence_old_videos(db) == 2
        local, cloud = json.loads(db.get(House, house["id"]).videos)
        # doing it again changes nothing
        assert silence_old_videos(db) == 0
        db.get(House, house["id"]).videos = "[]"
        db.commit()
    assert cloud == "https://res.cloudinary.com/demo/video/upload/ac_none/v1/respite/old-tour.mp4"
    assert local.startswith("/uploads/") and "-silent" in local
    streams = _streams(_tmp / "uploads" / local.removeprefix("/uploads/"))
    assert "Video:" in streams and "Audio:" not in streams


def test_password_change_revokes_old_tokens(client):
    tok = client.post("/auth/login", json={"email": "owner@example.com", "password": PW}).json()["accessToken"]
    h = {"Authorization": f"Bearer {tok}"}
    new = client.post("/auth/password", headers=h, json={"currentPassword": PW, "newPassword": "a-brand-new-password"})
    assert new.status_code == 200
    assert client.get("/auth/me", headers=h).status_code == 401
    h2 = {"Authorization": f"Bearer {new.json()['accessToken']}"}
    assert client.get("/auth/me", headers=h2).status_code == 200
    client.post("/auth/password", headers=h2, json={"currentPassword": "a-brand-new-password", "newPassword": PW})


def test_login_rate_limit(client):
    for _ in range(8):
        client.post("/auth/login", json={"email": "limit@example.com", "password": "x"})
    assert client.post("/auth/login", json={"email": "limit@example.com", "password": "x"}).status_code == 429


def _login(client) -> dict:
    """A fresh owner token (the password test above signs out the shared one, the rate limit test blocks this client)."""
    from app.security import login_limiter

    login_limiter._fails.clear()
    r = client.post("/auth/login", json={"email": "owner@example.com", "password": PW})
    return {"Authorization": f"Bearer {r.json()['accessToken']}"}


def test_rooms_add_hide_reorder_and_delete(client):
    auth = _login(client)
    before = client.get("/public/rooms").json()
    r = client.post("/admin/rooms", headers=auth, json={
        "name": "The Attic Room", "kind": "SHARED", "floor": "Upper", "bathroom": "Shared",
        "rentCents": 60000, "depositCents": 20000, "beds": 2})
    assert r.status_code == 201, r.text
    room = r.json()
    assert room["slug"] == "attic-room" and room["hidden"] is True
    # hidden: in the dashboard, not on the site
    assert len(client.get("/public/rooms").json()) == len(before)
    detail = client.get(f"/admin/rooms/{room['id']}", headers=auth).json()
    assert [b["label"] for b in detail["beds"]] == ["Bed 7", "Bed 8"]
    assert client.post("/admin/rooms", headers=auth, json={
        "name": "Two in private", "kind": "PRIVATE", "floor": "Upper", "bathroom": "Shared",
        "rentCents": 1, "depositCents": 1, "beds": 2}).status_code == 400

    shown = client.put(f"/admin/rooms/{room['id']}", headers=auth, json={
        "name": "The Attic Room", "summary": "", "description": "", "rentCents": 60000, "depositCents": 20000,
        "features": [], "hidden": False, "floor": "Upper"})
    assert shown.json()["hidden"] is False
    assert any(x["slug"] == "attic-room" for x in client.get("/public/rooms").json())

    ids = [x["id"] for x in client.get("/admin/rooms", headers=auth).json()]
    flipped = client.post("/admin/rooms/order", headers=auth, json={"ids": ids[::-1]}).json()
    assert flipped[0]["id"] == room["id"]
    client.post("/admin/rooms/order", headers=auth, json={"ids": ids})
    assert client.post("/admin/rooms/order", headers=auth, json={"ids": ids[:1]}).status_code == 400

    bed = client.post(f"/admin/rooms/{room['id']}/beds", headers=auth, json={}).json()
    assert bed["label"] == "Bed 9"
    assert client.patch(f"/admin/beds/{bed['id']}", headers=auth, json={"label": "Window bed"}).json()["label"] == "Window bed"
    assert client.delete(f"/admin/beds/{bed['id']}", headers=auth).status_code == 204

    # two beds can't become a private room
    private = client.put(f"/admin/rooms/{room['id']}", headers=auth, json={
        "name": "The Attic Room", "summary": "", "description": "", "rentCents": 60000, "depositCents": 20000,
        "features": [], "kind": "PRIVATE"})
    assert private.status_code == 400 and "one bed" in private.json()["detail"]

    # a room someone lives in can't go
    lived_in = next(x for x in client.get("/admin/rooms", headers=auth).json() if any(s["state"] != "open" for s in x["states"]))
    assert client.delete(f"/admin/rooms/{lived_in['id']}", headers=auth).status_code == 400
    assert client.delete(f"/admin/rooms/{room['id']}", headers=auth).status_code == 204
    assert client.get(f"/admin/rooms/{room['id']}", headers=auth).status_code == 404


def test_site_content_defaults_edit_and_reset(client):
    auth = _login(client)
    c = client.get("/public/content").json()
    assert c["house"]["phone"] == "804-803-6248" and c["house"]["phoneHref"] == "tel:+18048036248"
    assert len(c["faq"]["items"]) == 6 and [x["key"] for x in c["who"]["chapters"]] == ["VETERAN", "RECOVERY", "SENIOR"]
    assert client.put("/admin/content/faq", json={"items": []}).status_code == 401

    house = {**c["house"], "phone": " (804) 555-0100 "}
    house.pop("phoneHref")
    saved = client.put("/admin/content/house", headers=auth, json=house)
    assert saved.status_code == 200 and saved.json()["phone"] == "(804) 555-0100"
    assert client.get("/public/content").json()["house"]["phoneHref"] == "tel:+18045550100"
    bad = client.put("/admin/content/house", headers=auth, json={**house, "phone": "  "})
    assert bad.status_code == 400 and "phone" in bad.json()["detail"]

    # the contact email: defaults to support@, can be hidden, rejects junk, and an older saved house without it still loads
    assert c["house"]["email"] == "support@respite4theweary.com"
    assert client.put("/admin/content/house", headers=auth, json={**house, "email": " Help@Example.org "}).json()["email"] == "help@example.org"
    assert client.put("/admin/content/house", headers=auth, json={**house, "email": ""}).json()["email"] == ""
    assert client.put("/admin/content/house", headers=auth, json={**house, "email": "not an email"}).status_code == 400
    from app.models import SiteContent
    import json as _json
    with SessionLocal() as db:
        old = {k: v for k, v in house.items() if k != "email"}
        db.get(SiteContent, "house").value = _json.dumps(old)
        db.commit()
    got = client.get("/public/content").json()["house"]
    assert got["phone"] == "(804) 555-0100" and got["email"] == "support@respite4theweary.com"

    items = c["faq"]["items"][::-1] + [{"q": "Pets?", "a": "Ask us."}]
    assert client.put("/admin/content/faq", headers=auth, json={"items": items}).json()["items"][0]["q"] == "Can we visit first?"
    who = c["who"]
    who["chapters"] = who["chapters"][:2]
    assert client.put("/admin/content/who", headers=auth, json=who).status_code == 400

    up = client.post("/admin/content/photo", headers=auth, files={"photo": ("k.webp", b"RIFF fake", "image/webp")})
    assert up.status_code == 201 and up.json()["src"].startswith("/uploads/site-")

    for key in ("house", "faq"):
        client.post(f"/admin/content/{key}/reset", headers=auth)
    assert client.get("/public/content").json()["house"]["phone"] == "804-803-6248"


def test_staff_can_work_but_not_manage_the_team(client):
    auth = _login(client)
    r = client.post("/admin/users", headers=auth, json={"email": "helper@example.com", "name": "Helper", "password": "staff-password-1"})
    assert r.status_code == 201 and r.json()["role"] == "STAFF"
    staff_id = r.json()["id"]
    tok = client.post("/auth/login", json={"email": "helper@example.com", "password": "staff-password-1"}).json()["accessToken"]
    staff = {"Authorization": f"Bearer {tok}"}
    assert client.get("/auth/me", headers=staff).json()["role"] == "STAFF"
    assert client.get("/admin/rooms", headers=staff).status_code == 200
    assert client.get("/admin/users", headers=staff).status_code == 200
    assert client.post("/admin/users", headers=staff, json={"email": "x@example.com", "password": "another-password"}).status_code == 403
    assert client.delete(f"/admin/users/{staff_id}", headers=staff).status_code == 403

    me = client.get("/auth/me", headers=auth).json()
    assert client.patch(f"/admin/users/{me['id']}", headers=auth, json={"role": "STAFF"}).status_code == 400  # last owner
    assert client.patch(f"/admin/users/{staff_id}", headers=auth, json={"role": "OWNER"}).json()["role"] == "OWNER"
    assert client.get("/auth/me", headers=staff).status_code == 401  # role change signs them out
    assert client.delete(f"/admin/users/{staff_id}", headers=auth).status_code == 204


def _sent(kind):
    with SessionLocal() as db:
        return [n for n in db.query(Notification).filter(Notification.kind == kind, Notification.channel == "EMAIL").all()]


def test_tours_schedule_book_cancel_and_remind(client):
    auth = _login(client)
    from datetime import timedelta

    from app.models import Tour
    from app.services import tours

    # nothing is bookable until the owners set times
    assert client.get("/public/tours/slots").json() == {"enabled": False, "days": []}
    assert client.put("/admin/tours/settings", json={"enabled": True, "slots": [{"day": 9, "time": "10:00"}]}, headers=auth).status_code == 400
    every_day = [{"day": d, "time": t} for d in range(7) for t in ("10:00", "14:30")]
    closed = (tours.local_now().date() + timedelta(days=3)).isoformat()
    s = client.put("/admin/tours/settings", json={"enabled": True, "slots": every_day, "closedDays": [closed]}, headers=auth).json()
    assert len(s["slots"]) == 14 and s["daysAhead"] == 21
    days = client.get("/public/tours/slots").json()["days"]
    assert days and closed not in [d["date"] for d in days]
    first = days[0]
    assert tours.starts_at(first["date"], first["times"][0]) >= tours.local_now() + timedelta(hours=12)

    pick = {"date": first["date"], "time": first["times"][0]}
    assert client.post("/public/tours", json={**pick, "name": "A", "phone": "8045550100"}).status_code == 400
    r = client.post("/public/tours", json={**pick, "name": "Dana Whitfield", "phone": "804-555-0100", "email": "dana@example.com", "program": "VETERAN"})
    assert r.status_code == 201, r.text
    token = r.json()["token"]
    assert client.post("/public/tours", json={**pick, "name": "Lee Boone", "phone": "804-555-0101"}).status_code == 409
    after = client.get("/public/tours/slots").json()["days"]
    assert pick["time"] not in next(d["times"] for d in after if d["date"] == pick["date"]) if any(d["date"] == pick["date"] for d in after) else True
    assert any(n.recipient == "dana@example.com" and "/tour/" in n.body for n in _sent("tour.confirmed"))
    assert any("Dana Whitfield" in n.subject for n in _sent("tour.booked"))

    # the visitor's link shows it and cancels it, which frees the time
    assert client.get(f"/public/tours/{token}").json()["status"] == "BOOKED"
    assert client.get("/public/tours/nope").status_code == 404
    assert client.post(f"/public/tours/{token}/cancel").json()["status"] == "CANCELLED"
    again = client.get("/public/tours/slots").json()["days"]
    assert pick["time"] in next(d["times"] for d in again if d["date"] == pick["date"])

    # the house books a caller, then cancels: the visitor is told
    r = client.post("/admin/tours", json={**pick, "name": "Lee Boone", "phone": "804-555-0101", "email": "lee@example.com"}, headers=auth)
    assert r.status_code == 201, r.text
    assert client.post("/admin/tours", json={**pick, "name": "Sam Ortiz", "phone": "804-555-0102"}, headers=auth).status_code == 409
    upcoming = client.get("/admin/tours", headers=auth).json()
    assert [t["name"] for t in upcoming] == ["Lee Boone"] and upcoming[0]["when"]
    assert client.patch(f"/admin/tours/{r.json()['id']}", json={"status": "CANCELLED"}, headers=auth).json()["cancelledBy"] == "HOUSE"
    assert any(n.recipient == "lee@example.com" for n in _sent("tour.cancelled"))
    assert {t["name"] for t in client.get("/admin/tours?when=past", headers=auth).json()} >= {"Dana Whitfield", "Lee Boone"}

    # a tour a few hours out, booked days ago, gets one reminder each side
    soon = tours.local_now() + timedelta(hours=3)
    r = client.post("/admin/tours", json={"date": soon.date().isoformat(), "time": soon.strftime("%H:%M"), "name": "Rae Kim", "phone": "804-555-0103", "email": "rae@example.com"}, headers=auth)
    with SessionLocal() as db:
        db.get(Tour, r.json()["id"]).createdAt = now() - timedelta(days=2)
        db.commit()
    cron = {"Authorization": "Bearer cron-test"}
    assert client.post("/cron/notifications", headers=cron).json()["reminded"] == 1
    assert client.post("/cron/notifications", headers=cron).json()["reminded"] == 0
    assert any(n.recipient == "rae@example.com" for n in _sent("tour.reminder"))
    assert any(n.recipient == "owner@example.com" and "Rae Kim" in n.subject for n in _sent("tour.reminder"))


def test_tour_names_the_house_they_picked(client):
    auth = _login(client)
    every_day = [{"day": d, "time": t} for d in range(7) for t in ("09:00", "11:15", "16:45")]
    client.put("/admin/tours/settings", json={"enabled": True, "slots": every_day}, headers=auth)
    days = client.get("/public/tours/slots").json()["days"]
    house = client.get("/public/houses").json()[0]
    pick = {"date": days[-1]["date"], "time": days[-1]["times"][-1]}

    # an unknown house is turned down, a real one is kept and named everywhere
    assert client.post("/public/tours", json={**pick, "name": "Jo March", "phone": "804-555-0110", "house": "no-such-house"}).status_code == 400
    r = client.post("/public/tours", json={**pick, "name": "Jo March", "phone": "804-555-0110", "email": "jo@example.com", "house": house["slug"]})
    assert r.status_code == 201, r.text
    assert r.json()["house"]["slug"] == house["slug"]
    assert client.get(f"/public/tours/{r.json()['token']}").json()["house"]["name"] == house["name"]
    assert any(n.recipient == "jo@example.com" and f"House: {house['name']}" in n.body for n in _sent("tour.confirmed"))
    assert any(house["name"] in n.subject for n in _sent("tour.booked") if "Jo March" in n.subject)
    listed = next(t for t in client.get("/admin/tours", headers=auth).json() if t["name"] == "Jo March")
    assert listed["houseName"] == house["name"] and listed["houseId"] == house["id"]
    assert f"Tour of {house['name']}" in client.get(f"/public/tours/{r.json()['token']}/calendar.ics").text

    # without a house it still books, like tours from before there was a choice
    other = {"date": days[-1]["date"], "time": days[-1]["times"][0]}
    r = client.post("/public/tours", json={**other, "name": "Amy March", "phone": "804-555-0111"})
    assert r.status_code == 201 and r.json()["house"] is None

    # the house can book a caller for a given house too
    r = client.post("/admin/tours", json={"date": days[-2]["date"], "time": "12:00", "name": "Meg March", "phone": "804-555-0112", "houseId": house["id"]}, headers=auth)
    assert r.status_code == 201 and r.json()["houseName"] == house["name"]
    assert client.post("/admin/tours", json={"date": days[-2]["date"], "time": "12:30", "name": "Beth March", "phone": "804-555-0113", "houseId": "nope"}, headers=auth).status_code == 404


def test_waitlist_join_announce_and_leave(client):
    auth = _login(client)
    from app.models import WaitlistEntry

    assert client.post("/public/waitlist", json={"name": "Pat Greer", "email": "not-an-email"}).status_code == 400
    r = client.post("/public/waitlist", json={"name": "Pat Greer", "email": "Pat@Example.com", "room": "maple-room"})
    assert r.status_code == 201 and r.json()["again"] is False
    assert client.post("/public/waitlist", json={"name": "Pat Greer", "email": "pat@example.com"}).json()["again"] is True
    listed = client.get("/admin/waitlist", headers=auth).json()
    assert [w["email"] for w in listed] == ["pat@example.com"] and listed[0]["roomName"] is None
    with SessionLocal() as db:
        token = db.query(WaitlistEntry).one().token
    assert any("/waitlist/" in n.body for n in _sent("waitlist.joined"))

    # anything that opens a bed tells the people waiting, once
    bed = client.get("/admin/beds", headers=auth).json()[0]
    assert client.patch(f"/admin/beds/{bed['id']}", json={"availableFrom": "2027-01-15"}, headers=auth).status_code == 200
    told = _sent("waitlist.opening")
    assert len(told) == 1 and told[0].recipient == "pat@example.com" and "/apply?room=" in told[0].body
    assert client.get("/admin/waitlist", headers=auth).json()[0]["status"] == "NOTIFIED"
    client.patch(f"/admin/beds/{bed['id']}", json={"availableFrom": "2027-01-16"}, headers=auth)
    assert len(_sent("waitlist.opening")) == 1

    # their link takes them off
    assert client.get(f"/public/waitlist/{token}").json()["firstName"] == "Pat"
    assert client.post(f"/public/waitlist/{token}/leave").json()["status"] == "REMOVED"
    assert client.get("/admin/waitlist", headers=auth).json() == []


def test_forgot_and_reset_password(client):
    _login(client)
    assert client.post("/auth/forgot", json={"email": "nobody@example.com"}).json() == {"ok": True}
    assert client.post("/auth/forgot", json={"email": " Owner@Example.com "}).json() == {"ok": True}
    mail = _sent("auth.reset")
    assert len(mail) == 1 and mail[0].recipient == "owner@example.com"
    token = mail[0].body.split("/admin/reset/")[1].split()[0]

    assert client.get(f"/auth/reset/{token}").json() == {"valid": True, "email": "owner@example.com"}
    assert client.get("/auth/reset/not-a-token").json()["valid"] is False
    assert client.post("/auth/reset", json={"token": token, "password": "short"}).status_code == 422
    old = _login(client)
    r = client.post("/auth/reset", json={"token": token, "password": "a-reset-password-123"})
    assert r.status_code == 200 and "resetTokenHash" not in r.json()["user"]
    assert client.get("/auth/me", headers=old).status_code == 401  # every old session is signed out
    assert client.post("/auth/reset", json={"token": token, "password": "another-password-1"}).status_code == 400  # works once
    assert client.post("/auth/login", json={"email": "owner@example.com", "password": "a-reset-password-123"}).status_code == 200

    # put it back for the tests after this one
    h = {"Authorization": f"Bearer {r.json()['accessToken']}"}
    assert client.post("/auth/password", headers=h, json={"currentPassword": "a-reset-password-123", "newPassword": PW}).status_code == 200


def test_forgot_password_is_rate_limited(client):
    from app.security import login_limiter

    login_limiter._fails.clear()
    for _ in range(8):
        client.post("/auth/forgot", json={"email": "someone@example.com"})
    assert client.post("/auth/forgot", json={"email": "someone@example.com"}).status_code == 429
    login_limiter._fails.clear()


def _new_resident(client, auth, name: str, email: str | None, phone: str = "804 555 0199") -> dict:
    req = client.post("/public/requests", json={
        "forWhom": "SELF", "program": "VETERAN", "moveIn": "ASAP", "payment": "VA", "name": name, "phone": phone, **({"email": email} if email else {}),
    }).json()["id"]
    from app.models import Bed, Room
    from app.routers.admin import _next_bed_label

    with SessionLocal() as db:  # a fresh bed each time, so earlier tests can't fill the house
        room = db.query(Room).first()
        bed = Bed(label=_next_bed_label(db, room.houseId), roomId=room.id)
        db.add(bed)
        db.commit()
        bed = {"id": bed.id}
    mi = client.post(f"/admin/requests/{req}/move-in", headers=auth, json={"bedId": bed["id"], "moveInDate": "2026-11-01", "rentCents": 80000, "depositCents": 25000})
    assert mi.status_code == 201, mi.text
    return client.get(f"/admin/residents/{mi.json()['residentId']}", headers=auth).json()


def test_overdue_rent_reminded_once(client, monkeypatch):
    auth = _login(client)
    from datetime import timedelta

    from app.config import get_settings

    s = get_settings()
    for k, v in {"twilio_account_sid": "AC1", "twilio_auth_token": "t", "twilio_from": "+15405550100"}.items():
        monkeypatch.setattr(s, k, v)
    texts_out = []
    monkeypatch.setattr(notify, "deliver_sms", lambda to, body: texts_out.append(to))  # never call Twilio from tests
    res = _new_resident(client, auth, "Owen Late", "owen@example.com", phone="(804) 555-0177")
    noemail = _new_resident(client, auth, "Nell Quiet", None)
    client.patch(f"/admin/residents/{noemail['id']}", headers=auth, json={"name": "Nell Quiet", "phone": "", "email": "", "rentCents": 80000})
    late = (now() - timedelta(days=5)).date().isoformat()
    fresh = (now() - timedelta(days=1)).date().isoformat()
    ancient = (now() - timedelta(days=90)).date().isoformat()
    for rid, due in ((res["id"], late), (res["id"], fresh), (res["id"], ancient), (noemail["id"], late)):
        assert client.post(f"/admin/residents/{rid}/charges", headers=auth, json={"label": f"Rent {due}", "amountCents": 10000, "dueDate": due}).status_code == 201

    cron = {"Authorization": "Bearer cron-test"}
    first = client.post("/cron/notifications", headers=cron).json()
    assert first["overdue"] >= 2
    assert client.post("/cron/notifications", headers=cron).json()["overdue"] == 0
    owen = [n for n in _sent("rent.overdue") if n.recipient == "owen@example.com"]
    assert len(owen) == 1 and late in owen[0].body and fresh not in owen[0].body and ancient not in owen[0].body
    with SessionLocal() as db:
        texts = db.query(Notification).filter_by(channel="SMS", kind="rent.overdue", recipient="+18045550177").all()
        assert len(texts) == 1 and "/portal/" in texts[0].body and texts[0].status == "SENT"
        inbox = db.query(Notification).filter_by(channel="INBOX", kind="rent.overdue").all()
        assert any("Nell Quiet" in n.subject for n in inbox)
    assert "+18045550177" in texts_out


def test_sms_needs_twilio_and_a_real_number():
    from app.services.sms import normalize

    assert normalize("(804) 555-0100") == "+18045550100"
    assert normalize("1 804 555 0100") == "+18045550100"
    assert normalize("+44 20 7946 0958") == "+442079460958"
    assert normalize("555-0100") is None and normalize(None) is None
    with SessionLocal() as db:
        assert notify.sms(db, "804 555 0100", "hi", "test") is None  # no Twilio settings in tests


def test_notes_documents_deposit_statement_and_export(client):
    auth = _login(client)
    res = _new_resident(client, auth, "Iris Record", "iris@example.com")
    rid, token = res["id"], res["portalToken"]

    # notes
    assert client.post(f"/admin/residents/{rid}/notes", headers=auth, json={"kind": "CHECKIN", "body": "  "}).status_code == 400
    n = client.post(f"/admin/residents/{rid}/notes", headers=auth, json={"kind": "INCIDENT", "body": "Smoke alarm went off at 2am."}).json()
    assert n["kind"] == "INCIDENT" and n["author"]
    assert [x["body"] for x in client.get(f"/admin/residents/{rid}/notes", headers=auth).json()] == ["Smoke alarm went off at 2am."]
    assert client.delete(f"/admin/notes/{n['id']}", headers=auth).status_code == 204
    assert client.get(f"/admin/residents/{rid}/notes", headers=auth).json() == []

    # documents are private: stored in the database, only served to a signed in owner
    bad = client.post(f"/admin/residents/{rid}/documents", headers=auth, files={"file": ("x.exe", b"MZ", "application/octet-stream")})
    assert bad.status_code == 400
    up = client.post(f"/admin/residents/{rid}/documents", headers=auth, files={"file": ("lease.pdf", b"%PDF-1.4 test", "application/pdf")})
    assert up.status_code == 201, up.text
    doc = up.json()
    assert doc["size"] == 13 and "data" not in doc
    assert client.get(f"/admin/documents/{doc['id']}").status_code == 401
    got = client.get(f"/admin/documents/{doc['id']}", headers=auth)
    assert got.content == b"%PDF-1.4 test" and got.headers["content-type"] == "application/pdf"
    assert [d["name"] for d in client.get(f"/admin/residents/{rid}/documents", headers=auth).json()] == ["lease.pdf"]
    assert client.delete(f"/admin/documents/{doc['id']}", headers=auth).status_code == 204

    # pay the deposit, move out, settle it
    dep = next(c for c in res["charges"] if c["label"] == "Security deposit")
    client.post(f"/admin/charges/{dep['id']}/pay", headers=auth, json={"method": "CASH"})
    assert client.patch(f"/admin/residents/{rid}/deposit", headers=auth, json={"returnedCents": 0}).status_code == 400  # still living there
    client.post(f"/admin/residents/{rid}/move-out", headers=auth)
    assert client.patch(f"/admin/residents/{rid}/deposit", headers=auth, json={"returnedCents": 30000}).status_code == 400  # more than paid
    assert client.patch(f"/admin/residents/{rid}/deposit", headers=auth, json={"returnedCents": 20000}).status_code == 400  # kept some, no reason
    d = client.patch(f"/admin/residents/{rid}/deposit", headers=auth, json={"returnedCents": 20000, "note": "Replaced a broken blind."}).json()
    assert d == {**d, "paidCents": 25000, "returnedCents": 20000, "keptCents": 5000}

    # the statement, for the owner and for the resident
    st = client.get(f"/admin/residents/{rid}/statement", headers=auth).json()
    assert st["resident"]["name"] == "Iris Record" and st["totals"]["paidCents"] == 25000
    assert st["totals"]["owedCents"] == st["totals"]["billedCents"] - 25000
    assert st["deposit"]["returnedCents"] == 20000 and st["house"]["phone"]
    assert client.get(f"/portal/{token}/statement").json()["totals"] == st["totals"]
    assert client.get("/portal/nope/statement").status_code == 404

    # the accountant's spreadsheet
    csv_ = client.get("/admin/export.csv?kind=payments", headers=auth)
    assert csv_.status_code == 200 and csv_.headers["content-type"].startswith("text/csv")
    lines = csv_.text.lstrip("﻿").splitlines()
    assert lines[0] == "Date paid,Resident,For,Amount,Method,Due date"
    assert any(line.startswith(now().date().isoformat()) and "Iris Record,Security deposit,250.00,Cash" in line for line in lines)
    assert "Iris Record" not in client.get("/admin/export.csv?kind=payments&from=2020-01-01&to=2020-12-31", headers=auth).text
    assert client.get("/admin/export.csv?kind=charges", headers=auth).text.lstrip("﻿").startswith("Due date,Resident")
    assert client.get("/admin/export.csv?from=nope", headers=auth).status_code == 400
    assert client.get("/admin/export.csv").status_code == 401


def test_repairs_from_the_portal(client):
    auth = _login(client)
    res = _new_resident(client, auth, "Rex Fixit", "rex@example.com")
    token = res["portalToken"]
    assert client.post(f"/portal/{token}/repairs", json={"area": "Bathroom", "body": "  "}).status_code in (400, 422)
    r = client.post(f"/portal/{token}/repairs", json={"area": "Bathroom", "body": "The sink drips all night.", "urgent": True})
    assert r.status_code == 201, r.text
    assert client.get(f"/portal/{token}").json()["repairs"][0]["status"] == "OPEN"
    with SessionLocal() as db:
        alert = db.query(Notification).filter_by(channel="INBOX", kind="repair.new").one()
        assert alert.subject.startswith("Urgent repair: Bathroom, Rex Fixit")

    listed = client.get("/admin/repairs", headers=auth).json()
    assert [x["resident"]["name"] for x in listed] == ["Rex Fixit"]
    rep = listed[0]["id"]
    assert client.patch(f"/admin/repairs/{rep}", headers=auth, json={"status": "DOING"}).json()["status"] == "DOING"
    assert not [n for n in _sent("repair.done") if n.recipient == "rex@example.com"]
    done = client.patch(f"/admin/repairs/{rep}", headers=auth, json={"status": "DONE", "ownerNote": "New washer fitted."}).json()
    assert done["doneAt"] and client.get("/admin/repairs", headers=auth).json() == []
    told = [n for n in _sent("repair.done") if n.recipient == "rex@example.com"]
    assert len(told) == 1 and "New washer fitted." in told[0].body
    assert [x["id"] for x in client.get("/admin/repairs?status=done", headers=auth).json()] == [rep]

    client.post(f"/admin/residents/{res['id']}/move-out", headers=auth)
    assert client.post(f"/portal/{token}/repairs", json={"area": "Other", "body": "Still dripping"}).status_code == 403


def test_tour_calendar_files_and_owner_feed(client):
    auth = _login(client)
    from datetime import timedelta

    from app.services import tours

    day = (tours.local_now().date() + timedelta(days=4)).isoformat()
    t = client.post("/admin/tours", headers=auth, json={"date": day, "time": "11:15", "name": "Cal Endar", "phone": "804-555-0144", "email": "cal@example.com"}).json()
    view = client.get(f"/public/tours/{t['token']}").json()
    from datetime import UTC

    start = tours.starts_at(day, "11:15").astimezone(UTC)
    assert view["startsAt"].endswith("Z") and view["endsAt"] > view["startsAt"]
    assert view["startsAt"].startswith(start.strftime("%Y-%m-%dT%H:%M"))
    assert any(f"/tour/{t['token']}/calendar" in n.body for n in _sent("tour.confirmed") if n.recipient == "cal@example.com")

    one = client.get(f"/public/tours/{t['token']}/calendar.ics")
    assert one.status_code == 200 and one.headers["content-type"].startswith("text/calendar")
    assert "BEGIN:VEVENT" in one.text and f"DTSTART:{start.strftime('%Y%m%dT%H%M%SZ')}" in one.text
    assert "804-555-0144" not in one.text  # the visitor's own file has the house's details, not theirs

    # the owners' private feed
    assert client.get("/admin/tours/feed").status_code == 401
    url = client.get("/admin/tours/feed", headers=auth).json()["url"]
    assert url == client.get("/admin/tours/feed", headers=auth).json()["url"]  # stays the same
    token = url.rsplit("/", 1)[1].removesuffix(".ics")
    feed = client.get(f"/public/feeds/tours/{token}.ics")
    assert feed.status_code == 200 and "Tour: Cal Endar" in feed.text and "804-555-0144" in feed.text
    assert client.get("/public/feeds/tours/wrong.ics").status_code == 404
    new = client.post("/admin/tours/feed/reset", headers=auth).json()["url"]
    assert new != url and client.get(f"/public/feeds/tours/{token}.ics").status_code == 404

    # the month view
    month = client.get(f"/admin/tours?when=month&month={day[:7]}", headers=auth).json()
    assert "Cal Endar" in [x["name"] for x in month]
    assert client.get("/admin/tours?when=month&month=2026-13", headers=auth).status_code == 422


def test_pay_in_person_then_receipt(client):
    auth = _login(client)
    res = _new_resident(client, auth, "Iris Inperson", "iris@example.com")
    token = res["portalToken"]
    ids = [c["id"] for c in res["charges"]]

    assert client.post(f"/portal/{token}/in-person", json={"chargeIds": ids, "method": "BITCOIN"}).status_code == 400
    assert client.post(f"/portal/{token}/in-person", json={"chargeIds": ids, "method": "CASH"}).json() == {"planned": 2}
    charges = client.get(f"/portal/{token}").json()["charges"]
    assert all(c["inPersonMethod"] == "CASH" and c["status"] == "DUE" for c in charges)
    with SessionLocal() as db:
        alert = db.query(Notification).filter_by(channel="INBOX", kind="payment.in_person").order_by(Notification.createdAt.desc()).first()
        assert "Iris Inperson will pay $1,050 in person, with cash" in alert.subject

    assert client.post(f"/admin/charges/{ids[0]}/pay", headers=auth, json={"method": "CASH"}).status_code == 200
    assert client.post(f"/admin/charges/{ids[0]}/pay", headers=auth, json={"method": "CASH"}).status_code == 409  # already paid
    assert ("payment.receipt", "iris@example.com", "PENDING") in _emails(recipient="iris@example.com")

    # once it's all paid there's nothing left to bring in
    client.post(f"/admin/charges/{ids[1]}/pay", headers=auth, json={"method": "CHECK"})
    assert client.post(f"/portal/{token}/in-person", json={"chargeIds": [], "method": "CASH"}).status_code == 409


def test_refunds_in_person_and_through_stripe(client, monkeypatch):
    import stripe
    from app.config import get_settings
    from app.models import Charge

    auth = _login(client)
    res = _new_resident(client, auth, "Rhea Refund", "rhea@example.com")
    cash, card = sorted(res["charges"], key=lambda c: c["amountCents"])
    client.post(f"/admin/charges/{cash['id']}/pay", headers=auth, json={"method": "CASH"})

    assert client.post(f"/admin/charges/{card['id']}/refund", headers=auth, json={}).status_code == 409  # not paid yet
    assert client.post(f"/admin/charges/{cash['id']}/void", headers=auth).status_code == 409  # paid: refund, don't void

    # a cash payment is given back by hand: no Stripe call
    r = client.post(f"/admin/charges/{cash['id']}/refund", headers=auth, json={"note": "Moved in elsewhere"})
    assert r.status_code == 200 and r.json()["ok"] == "Refunded $250."
    assert client.post(f"/admin/charges/{cash['id']}/refund", headers=auth, json={}).status_code == 409  # only once

    # the card charge was paid through Stripe Checkout
    with SessionLocal() as db:
        c = db.get(Charge, card["id"])
        c.status, c.paidAt, c.method, c.stripeSessionId = "PAID", now(), "STRIPE", "cs_test_1"
        db.commit()
    assert client.post(f"/admin/charges/{card['id']}/refund", headers=auth, json={}).status_code == 409  # Stripe not connected

    calls = []
    monkeypatch.setattr(get_settings(), "stripe_secret_key", "sk_test_x")
    monkeypatch.setattr(stripe.checkout.Session, "retrieve", lambda sid, **_: {"id": sid, "payment_intent": "pi_1"})

    def fake_refund(**kw):
        calls.append(kw)
        return stripe.Refund.construct_from({"id": "re_1", "status": "pending"}, "sk_test_x")

    monkeypatch.setattr(stripe.Refund, "create", fake_refund)
    r = client.post(f"/admin/charges/{card['id']}/refund", headers=auth, json={})
    assert r.status_code == 200 and r.json()["ok"] == "Refunded $800 through Stripe."
    assert calls[0]["payment_intent"] == "pi_1" and calls[0]["amount"] == 80000 and calls[0]["idempotency_key"] == f"respite-refund-{card['id']}"
    assert [k for k, *_ in _emails(recipient="rhea@example.com")].count("payment.refunded") == 2

    st = client.get(f"/portal/{res['portalToken']}/statement").json()
    assert st["totals"] == {"billedCents": 0, "paidCents": 0, "owedCents": 0}

    csv = client.get("/admin/export.csv?kind=payments", headers=auth).text
    assert "-800.00,Stripe refund" in csv

    from app.services.payments import refund_failed, refunded_in_stripe

    # a refund that bounces puts the charge back to paid and tells the owners
    with SessionLocal() as db:
        refund_failed(db, {"id": "re_1", "status": "failed", "failure_reason": "account_closed"})
        assert db.get(Charge, card["id"]).status == "PAID"
        # Stripe telling us about the refund we made ourselves is not news...
        db.get(Charge, card["id"]).status = "REFUNDED"
        db.commit()
        refunded_in_stripe(db, {"payment_intent": "pi_1", "refunded": True, "amount": 80000, "amount_refunded": 80000})
        assert db.get(Charge, card["id"]).status == "REFUNDED"
        # ...but a refund made in the Stripe dashboard is recorded here
        c = db.get(Charge, card["id"])
        c.status, c.stripePaymentIntentId = "PAID", "pi_2"
        db.commit()
        refunded_in_stripe(db, {"payment_intent": "pi_2", "refunded": True, "amount": 80000, "amount_refunded": 80000})
        db.refresh(c)
        assert c.status == "REFUNDED" and c.refundNote == "Refunded from the Stripe dashboard."


def test_staff_cannot_refund(client):
    auth = _login(client)
    res = _new_resident(client, auth, "Sid Staffcheck", None)
    cid = res["charges"][0]["id"]
    client.post(f"/admin/charges/{cid}/pay", headers=auth, json={"method": "CASH"})
    client.post("/admin/users", headers=auth, json={"email": "helper2@example.com", "name": "Helper", "role": "STAFF", "password": "another-long-password"})
    from app.security import login_limiter

    login_limiter._fails.clear()
    tok = client.post("/auth/login", json={"email": "helper2@example.com", "password": "another-long-password"}).json().get("accessToken")
    assert tok
    r = client.post(f"/admin/charges/{cid}/refund", headers={"Authorization": f"Bearer {tok}"}, json={})
    assert r.status_code == 403


def _due_cents(client, token: str) -> int:
    return sum(c["amountCents"] for c in client.get(f"/portal/{token}").json()["charges"] if c["status"] == "DUE")


def test_part_payments_from_the_portal_and_by_hand(client):
    auth = _login(client)
    res = _new_resident(client, auth, "Paula Part", "paula@example.com")
    t = res["portalToken"]
    assert _due_cents(client, t) == 105000  # $250 deposit + $800 rent

    # too small, then a fine part payment through the test-mode checkout
    assert client.post(f"/portal/{t}/checkout", json={"amountCents": 500}).status_code == 400
    url = client.post(f"/portal/{t}/checkout", json={"amountCents": 30000}).json()["url"]
    assert "&a=30000" in url
    assert client.post(f"/portal/{t}/demo-pay", json={"amountCents": 30000}).json()["paid"] == 2
    view = client.get(f"/portal/{t}").json()
    assert _due_cents(client, t) == 75000
    paid = sorted((c["label"], c["amountCents"]) for c in view["charges"] if c["status"] == "PAID")
    assert paid == [("November rent (part)", 5000), ("Security deposit", 25000)]
    assert view["policy"]["partialPayments"] is True and "stripeCustomerId" not in view

    # the house takes $100 cash against what's left
    rent = next(c for c in view["charges"] if c["status"] == "DUE")
    assert client.post(f"/admin/charges/{rent['id']}/pay", headers=auth, json={"method": "CASH", "amountCents": 90000}).status_code == 400
    piece = client.post(f"/admin/charges/{rent['id']}/pay", headers=auth, json={"method": "CASH", "amountCents": 10000}).json()
    assert piece["amountCents"] == 10000 and piece["status"] == "PAID" and piece["id"] != rent["id"]
    assert _due_cents(client, t) == 65000
    assert ("payment.receipt", "paula@example.com", "PENDING") in _emails(recipient="paula@example.com")

    st = client.get(f"/portal/{t}/statement").json()["totals"]
    assert st == {"billedCents": 105000, "paidCents": 40000, "owedCents": 65000}

    # the owners can turn part payments off
    rules = client.get("/admin/billing/settings", headers=auth).json()
    client.put("/admin/billing/settings", headers=auth, json={**rules, "partialPayments": False})
    assert client.post(f"/portal/{t}/checkout", json={"amountCents": 30000}).status_code == 400
    assert client.post(f"/portal/{t}/checkout", json={}).status_code == 200  # paying it all still works
    client.put("/admin/billing/settings", headers=auth, json=rules)


def test_late_fees_capped_once_and_owner_set(client):
    from app.models import Charge
    from app.services.billing import Policy, add_late_fees, late_fee_for

    assert late_fee_for(Policy(lateFeeCents=10000), 80000) == 8000  # never more than 10%
    auth = _login(client)
    res = _new_resident(client, auth, "Lenny Late", "lenny@example.com")
    rent = next(c for c in res["charges"] if c["label"].endswith("rent"))

    with SessionLocal() as db:
        assert add_late_fees(db) == 0  # off by default
    rules = client.get("/admin/billing/settings", headers=auth).json()
    assert client.put("/admin/billing/settings", headers=auth, json={**rules, "lateFeeCents": 5000, "lateFeeAfterDays": 31}).status_code == 422
    client.put("/admin/billing/settings", headers=auth, json={**rules, "lateFeeCents": 5000, "lateFeeAfterDays": 5})
    try:
        with SessionLocal() as db:
            add_late_fees(db)
            fees = db.query(Charge).filter_by(lateFeeForId=rent["id"]).all()
            assert [(f.label, f.amountCents) for f in fees] == [("Late fee, November rent", 5000)]
            assert not db.query(Charge).filter_by(lateFeeForId=next(c["id"] for c in res["charges"] if c["label"] == "Security deposit")).count()
            add_late_fees(db)  # a second run adds nothing more
            assert db.query(Charge).filter_by(lateFeeForId=rent["id"]).count() == 1
        assert "rent.late_fee" in [k for k, *_ in _emails(recipient="lenny@example.com")]
    finally:
        client.put("/admin/billing/settings", headers=auth, json=rules)


def test_autopay_in_test_mode(client):
    from app.models import Charge, Resident
    from app.services import autopay

    auth = _login(client)
    res = _new_resident(client, auth, "Abe Autopay", "abe@example.com")
    t = res["portalToken"]
    assert client.post(f"/portal/{t}/autopay").json()["url"] == f"/portal/{t}?autopay=on"
    view = client.get(f"/portal/{t}").json()
    assert view["autopay"] is True and view["autopayLabel"] == "Test card"

    with SessionLocal() as db:
        autopay.run(db)
        cs = db.query(Charge).filter_by(residentId=res["id"]).all()
        assert {(c.status, c.method) for c in cs} == {("PAID", "DEMO")}
        assert autopay.run(db) == 0  # nothing left to pay

    client.delete(f"/portal/{t}/autopay")
    with SessionLocal() as db:
        r = db.get(Resident, res["id"])
        assert not r.autopay and r.autopayLabel is None


def test_autopay_through_stripe(client, monkeypatch):
    import stripe
    from app.config import get_settings
    from app.models import Charge, Resident
    from app.services import autopay

    auth = _login(client)
    res = _new_resident(client, auth, "Sal Stripe", "sal@example.com")
    with SessionLocal() as db:
        r = db.get(Resident, res["id"])
        r.autopay, r.stripeCustomerId, r.stripePaymentMethodId, r.autopayLabel = True, "cus_1", "pm_1", "Bank account ending 6789"
        db.commit()
    monkeypatch.setattr(get_settings(), "stripe_secret_key", "sk_test_x")

    calls = []

    def processing(**kw):
        calls.append(kw)
        return stripe.PaymentIntent.construct_from({"id": "pi_auto", "status": "processing", "metadata": kw["metadata"]}, "sk_test_x")

    monkeypatch.setattr(stripe.PaymentIntent, "create", processing)
    with SessionLocal() as db:
        assert autopay.run(db) == 1
        assert calls[0]["amount"] == 105000 and calls[0]["off_session"] and calls[0]["customer"] == "cus_1"
        assert {c.autopayStatus for c in db.query(Charge).filter_by(residentId=res["id"])} == {"PROCESSING"}
        assert autopay.run(db) == 0  # never charged twice
        # the bank payment clears days later (the webhook lands here)
        autopay.settle(db, {"id": "pi_auto", "status": "succeeded", "metadata": calls[0]["metadata"]})
        cs = db.query(Charge).filter_by(residentId=res["id"]).all()
        assert {(c.status, c.method, c.stripePaymentIntentId, c.autopayStatus) for c in cs} == {("PAID", "ACH", "pi_auto", None)}

    # a declined card: the resident and owners are told, and the charge waits
    client.post(f"/admin/residents/{res['id']}/charges", headers=auth, json={"label": "Laundry card", "amountCents": 2000, "dueDate": "2026-11-02"})

    def declined(**kw):
        raise stripe.CardError("Your card was declined.", None, "card_declined")

    monkeypatch.setattr(stripe.PaymentIntent, "create", declined)
    with SessionLocal() as db:
        autopay.run(db)
        extra = db.query(Charge).filter_by(residentId=res["id"], status="DUE").one()
        assert extra.autopayStatus == "FAILED"
    assert "autopay.failed" in [k for k, *_ in _emails(recipient="sal@example.com")]


def test_replace_pay_link(client):
    from app.security import login_limiter

    auth = _login(client)
    res = _new_resident(client, auth, "Lina Link", "lina@example.com")
    old = res["portalToken"]
    assert client.get(f"/portal/{old}").status_code == 200

    # staff can send the link, but only an owner can replace it
    client.post("/admin/users", headers=auth, json={"email": "helper3@example.com", "name": "Helper", "role": "STAFF", "password": "another-long-password"})
    login_limiter._fails.clear()
    staff = {"Authorization": f"Bearer {client.post('/auth/login', json={'email': 'helper3@example.com', 'password': 'another-long-password'}).json()['accessToken']}"}
    assert client.post(f"/admin/residents/{res['id']}/new-link", headers=staff).status_code == 403

    r = client.post(f"/admin/residents/{res['id']}/new-link", headers=auth)
    assert r.status_code == 200 and "lina@example.com" in r.json()["ok"]
    new = client.get(f"/admin/residents/{res['id']}", headers=auth).json()["portalToken"]
    assert new != old
    assert client.get(f"/portal/{old}").status_code == 404
    assert client.post(f"/portal/{old}/checkout", json={}).status_code == 404
    view = client.get(f"/portal/{new}").json()
    assert view["name"] == "Lina Link" and len(view["charges"]) == 2  # nothing else changes
    assert [k for k, *_ in _emails(recipient="lina@example.com")].count("resident.pay_link") == 1


def test_photos_go_to_cloudinary_when_set(client, monkeypatch):
    import hashlib

    import httpx

    from app.config import get_settings
    from app.services import storage

    s = get_settings()
    monkeypatch.setattr(s, "cloudinary_url", "cloudinary://123:abc%2Fdef@demo-cloud")
    assert s.cloudinary == ("123", "abc/def", "demo-cloud")
    monkeypatch.setattr(s, "cloudinary_url", "https://example.com")
    assert s.cloudinary is None
    monkeypatch.setattr(s, "cloudinary_url", "")
    for k, v in {"cloudinary_cloud_name": "demo-cloud", "cloudinary_api_key": "123", "cloudinary_api_secret": " shh "}.items():
        monkeypatch.setattr(s, k, v)
    assert s.cloudinary == ("123", "shh", "demo-cloud")  # the three separate settings work too

    auth = _login(client)
    calls = []

    def fake_post(url, data, files, timeout):
        calls.append((url, data, files))
        body = {"secure_url": f"https://res.cloudinary.com/demo-cloud/image/upload/v1/{data['folder']}/{data['public_id']}.png"}
        return httpx.Response(200, json=body, request=httpx.Request("POST", url))

    monkeypatch.setattr(s, "cloudinary_url", "cloudinary://123:shh@demo-cloud")
    monkeypatch.setattr(get_settings(), "read_only_disk", True)  # like Render: Cloudinary still lets owners upload
    monkeypatch.setattr(storage.httpx, "post", fake_post)
    assert client.get("/admin/config", headers=auth).json()["canUploadPhotos"] is True

    room = client.get("/admin/rooms", headers=auth).json()[0]
    up = client.post(f"/admin/rooms/{room['id']}/photos", headers=auth, files={"photo": ("p.png", b"\x89PNG fake", "image/png")})
    assert up.status_code == 201
    assert up.json()["photos"][-1].startswith("https://res.cloudinary.com/demo-cloud/")

    url, data, files = calls[0]
    assert url == "https://api.cloudinary.com/v1_1/demo-cloud/image/upload"
    assert data["api_key"] == "123" and data["folder"] == "respite" and "shh" not in str(data)
    signed = f"folder=respite&public_id={data['public_id']}&timestamp={data['timestamp']}shh"
    assert data["signature"] == hashlib.sha1(signed.encode()).hexdigest()
    assert files["file"][1] == b"\x89PNG fake"

    site = client.post("/admin/content/photo", headers=auth, files={"photo": ("k.png", b"\x89PNG fake", "image/png")})
    assert site.json()["src"].startswith("https://res.cloudinary.com/")



def test_houses_rooms_move_hide_and_delete(client):
    auth = _login(client)
    houses = client.get("/admin/houses", headers=auth).json()
    assert len(houses) == 1 and houses[0]["rooms"] >= 4  # existing rooms land in the first house
    first = houses[0]
    assert all(r["house"]["id"] == first["id"] for r in client.get("/public/rooms").json())

    r = client.post("/admin/houses", headers=auth, json={"name": "The Maple Street House", "address": "12 Maple St, Petersburg, VA", "town": "Petersburg, Virginia"})
    assert r.status_code == 201, r.text
    second = r.json()
    assert second["slug"] == "maple-street-house"

    room = client.post("/admin/rooms", headers=auth, json={
        "name": "The Bay Room", "kind": "SHARED", "floor": "Ground", "bathroom": "Shared",
        "rentCents": 50000, "depositCents": 10000, "beds": 2, "houseId": second["id"], "hidden": False}).json()
    detail = client.get(f"/admin/rooms/{room['id']}", headers=auth).json()
    assert detail["house"]["id"] == second["id"]
    assert [b["label"] for b in detail["beds"]] == ["Bed 1", "Bed 2"]  # numbers start again per house

    public = client.get("/public/houses").json()
    assert [h["name"] for h in public][-1] == "The Maple Street House" and public[-1]["beds"] == 2
    # the street address stays off the public site: people get it when they book a tour
    assert all(h["address"] == "" for h in public)
    assert all(r["house"]["address"] == "" for r in client.get("/public/rooms").json())
    beds = client.get("/public/beds").json()
    assert {b["houseName"] for b in beds} >= {first["name"], "The Maple Street House"}

    # hiding a house hides its rooms and beds from the site
    client.put(f"/admin/houses/{second['id']}", headers=auth, json={"name": "The Maple Street House", "hidden": True})
    assert all(r["houseId"] != second["id"] for r in client.get("/public/rooms").json())
    assert all(h["id"] != second["id"] for h in client.get("/public/houses").json())
    assert any(h["id"] == second["id"] for h in client.get("/admin/houses", headers=auth).json())

    # can't delete a house that still has rooms; moving a room renumbers its beds in the new house
    assert client.delete(f"/admin/houses/{second['id']}", headers=auth).status_code == 400
    moved = client.put(f"/admin/rooms/{room['id']}", headers=auth, json={
        "name": "The Bay Room", "summary": "", "description": "", "rentCents": 50000, "depositCents": 10000,
        "features": [], "houseId": first["id"]})
    assert moved.status_code == 200, moved.text
    labels = [b["label"] for b in client.get(f"/admin/rooms/{room['id']}", headers=auth).json()["beds"]]
    taken = {b["label"] for b in client.get("/admin/beds", headers=auth).json() if b["houseId"] == first["id"] and b["roomSlug"] != "bay-room"}
    assert not set(labels) & taken
    assert client.delete(f"/admin/houses/{second['id']}", headers=auth).status_code == 204
    assert client.delete(f"/admin/houses/{first['id']}", headers=auth).status_code == 400  # keep at least one
    assert client.delete(f"/admin/rooms/{room['id']}", headers=auth).status_code == 204


def test_one_house_launch_wording_moves_to_the_new_defaults(client):
    import json

    from app.models import SiteContent
    from app.services.content import DEFAULTS, OLD_WORDING, refresh_old_wording

    old = OLD_WORDING["home"]["statement"][0]
    home = {**DEFAULTS["home"], "statement": old, "heroText": "The owners' own words."}
    with SessionLocal() as db:
        row = db.get(SiteContent, "home") or SiteContent(key="home", value="")
        row.value = json.dumps(home)
        db.add(row)
        db.commit()
        refresh_old_wording(db)
        refresh_old_wording(db)  # running it again changes nothing
        saved = json.loads(db.get(SiteContent, "home").value)
        assert saved["statement"] == DEFAULTS["home"]["statement"]
        assert "six beds" not in saved["statement"].lower()
        assert saved["heroText"] == "The owners' own words."  # what the owners wrote is kept
        db.delete(db.get(SiteContent, "home"))
        db.commit()
