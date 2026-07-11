"""Object storage — **STUB** for Phase 3.

Real implementation uploads to S3 / MinIO. The stub records the storage key
that *would* have been written and logs the call. The Invoice row keeps that
key so when real storage is wired up the existing rows can be backfilled.

# TODO(phase-3.5+): boto3 client; signed-URL generation; MinIO endpoint for dev.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..logging import get_logger

log = get_logger("integrations.storage")


def is_configured() -> bool:
    return False  # flip when AWS_ACCESS_KEY / S3_BUCKET are set


def put_invoice_pdf(*, invoice_number: str, pdf_bytes: bytes | None = None) -> str:
    """Stub upload — returns the storage key that the real client would write.

    Real call: s3.put_object(Bucket=..., Key=key, Body=pdf_bytes, ContentType='application/pdf')
    """
    today = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    key = f"invoices/{today}/{invoice_number}.pdf"
    log.info(
        "storage.put_invoice_pdf.stub",
        storage_key=key,
        bytes_size=len(pdf_bytes) if pdf_bytes else 0,
        message="Phase-3 stub. No bytes actually uploaded.",
    )
    return key


def signed_get_url(storage_key: str, *, expires_in: int = 600) -> str:
    """Stub signed URL — returns a placeholder so the API response shape is
    correct, but it doesn't resolve to a real file."""
    return f"/api/v1/invoices/_stub/{storage_key}?expires_in={expires_in}"
