import hashlib
import time

import httpx

from ..config import get_settings


def _sign(params: dict[str, str], secret: str) -> str:
    # Cloudinary's signature: the parameters sorted by name, joined as a query string, then the secret, SHA-1
    payload = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    return hashlib.sha1((payload + secret).encode()).hexdigest()


def _to_cloudinary(creds: tuple[str, str, str], name: str, data: bytes, content_type: str, folder: str) -> str:
    kind = "video" if content_type.startswith("video/") else "image"
    key, secret, cloud = creds
    params = {
        "folder": folder,
        "public_id": name.rsplit(".", 1)[0],
        "timestamp": str(int(time.time())),
    }
    r = httpx.post(
        f"https://api.cloudinary.com/v1_1/{cloud}/{kind}/upload",
        data={**params, "api_key": key, "signature": _sign(params, secret)},
        files={"file": (name, data, content_type)},
        timeout=300,
    )
    r.raise_for_status()
    return r.json()["secure_url"]


def save_photo(name: str, data: bytes, content_type: str) -> str:
    """Saves a room or homepage photo and returns the URL to store with it.

    In order of preference:
    - Cloudinary set up (CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY +
      CLOUDINARY_API_SECRET): photos go to Cloudinary and survive every deploy.
    - BLOB_READ_WRITE_TOKEN set: photos go to Vercel Blob.
    - Neither: photos go to UPLOAD_DIR (by default the website's public/uploads folder). Fine on
      your own computer, but on Render that disk is wiped on every deploy.
    """
    s = get_settings()
    if s.cloudinary:
        return _to_cloudinary(s.cloudinary, name, data, content_type, s.cloudinary_folder)
    if s.blob_read_write_token:
        token = s.blob_read_write_token
        store_id = token.split("_")[3] if token.count("_") >= 3 else ""
        r = httpx.put(
            "https://vercel.com/api/blob/",
            params={"pathname": f"rooms/{name}"},
            content=data,
            headers={
                "authorization": f"Bearer {token}",
                "x-api-version": "13",
                "x-vercel-blob-store-id": store_id,
                "x-vercel-blob-access": "public",
                "x-content-type": content_type,
                "x-add-random-suffix": "0",
            },
            timeout=60,
        )
        r.raise_for_status()
        return r.json()["url"]
    s.upload_dir.mkdir(parents=True, exist_ok=True)
    (s.upload_dir / name).write_bytes(data)
    return f"{s.upload_url_prefix.rstrip('/')}/{name}"


def video_ticket(name: str) -> dict | None:
    """Videos are too big to pass through the website, so with Cloudinary set up the browser sends
    them straight there. This signs that one upload; the secret never leaves the server."""
    s = get_settings()
    if not s.cloudinary:
        return None
    key, secret, cloud = s.cloudinary
    params = {"folder": s.cloudinary_folder, "public_id": name, "timestamp": str(int(time.time()))}
    return {
        "url": f"https://api.cloudinary.com/v1_1/{cloud}/video/upload",
        "fields": {**params, "api_key": key, "signature": _sign(params, secret)},
        "host": "https://res.cloudinary.com/",
    }
