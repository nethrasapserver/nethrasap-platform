"""Object storage — Cloudflare R2 (S3-compatible) via presigned URLs.

The backend never proxies file bytes. Clients upload directly to R2 with a
presigned PUT and staff/users read via short-lived presigned GETs. Presigning
is local HMAC math (no network round-trip), so the sync boto3 client is safe
to call from async handlers.

Key namespaces:
    kyc/...       — private documents (council certs, licenses). GET only via
                    short-lived signed URLs handed to authorized staff.
    products/...  — catalogue images, served publicly via STORAGE_PUBLIC_BASE_URL.
    invoices/...  — order invoices (B4). payslips/... — HR (B7).

When STORAGE_* env vars are absent (local dev before R2 is enabled), the
module degrades to a stub: keys are still minted and flows work end-to-end,
but URLs point at an obviously-fake host and nothing is stored.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from functools import lru_cache

from ..config import get_settings
from ..logging import get_logger

log = get_logger("integrations.storage")

PRESIGNED_PUT_TTL = 15 * 60  # client has 15 min to upload
PRESIGNED_GET_TTL = 5 * 60  # short-lived reads for private docs

_STUB_BASE = "https://storage-not-configured.invalid"

_EXT_BY_CONTENT_TYPE = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

ALLOWED_DOCUMENT_TYPES = ("application/pdf", "image/jpeg", "image/png")
ALLOWED_IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def is_configured() -> bool:
    s = get_settings()
    return bool(s.storage_endpoint and s.storage_access_key_id and s.storage_secret_access_key)


@lru_cache
def _client():
    import boto3
    from botocore.config import Config

    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.storage_endpoint,
        aws_access_key_id=s.storage_access_key_id,
        aws_secret_access_key=s.storage_secret_access_key,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def make_key(namespace: str, *, content_type: str, prefix: str = "") -> str:
    """Mint a collision-proof storage key: ns/2026/07/11/<uuid>.<ext>"""
    ext = _EXT_BY_CONTENT_TYPE.get(content_type, "bin")
    today = datetime.now(UTC).strftime("%Y/%m/%d")
    middle = f"{prefix}/" if prefix else ""
    return f"{namespace}/{today}/{middle}{uuid.uuid4().hex}.{ext}"


def presigned_put(key: str, *, content_type: str) -> str:
    """URL the client PUTs the file to (Content-Type must match)."""
    if not is_configured():
        log.warning("storage.presigned_put.stub", key=key)
        return f"{_STUB_BASE}/put/{key}"
    return _client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": get_settings().storage_bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=PRESIGNED_PUT_TTL,
    )


def presigned_get(key: str) -> str:
    """Short-lived read URL for a private object (KYC docs, invoices)."""
    if not is_configured():
        return f"{_STUB_BASE}/get/{key}"
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": get_settings().storage_bucket, "Key": key},
        ExpiresIn=PRESIGNED_GET_TTL,
    )


def public_url(key: str) -> str:
    """Public URL for catalogue images (bucket/custom-domain base)."""
    base = get_settings().storage_public_base_url.rstrip("/")
    if not base:
        return f"{_STUB_BASE}/public/{key}"
    return f"{base}/{key}"


def put_bytes(key: str, data: bytes, *, content_type: str) -> None:
    """Upload bytes directly (server-side generated files: invoices, payslips)."""
    if not is_configured():
        log.info("storage.put_bytes.stub", key=key, bytes=len(data))
        return
    _client().put_object(
        Bucket=get_settings().storage_bucket, Key=key, Body=data, ContentType=content_type
    )


def delete_object(key: str) -> None:
    """Best-effort delete (image replaced, request withdrawn)."""
    if not is_configured():
        log.info("storage.delete.stub", key=key)
        return
    try:
        _client().delete_object(Bucket=get_settings().storage_bucket, Key=key)
    except Exception:
        log.exception("storage.delete_failed", key=key)


def put_invoice_pdf(*, invoice_number: str, pdf_bytes: bytes | None = None) -> str:
    """Store an invoice PDF (B4 wires the real bytes from the PDF job)."""
    key = make_key("invoices", content_type="application/pdf")
    if pdf_bytes is not None and is_configured():
        _client().put_object(
            Bucket=get_settings().storage_bucket,
            Key=key,
            Body=pdf_bytes,
            ContentType="application/pdf",
        )
    else:
        log.info("storage.put_invoice_pdf.stub", key=key, invoice=invoice_number)
    return key


def signed_get_url(key: str, *, expires_seconds: int = PRESIGNED_GET_TTL) -> str:
    """Kept for services that used the old stub name."""
    return presigned_get(key)
