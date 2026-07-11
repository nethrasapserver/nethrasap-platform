"""OTP issuance & verification — the phone-possession proof machinery.

Flow:
  1. `request_otp` — mints a 6-digit code, stores only its SHA-256 hash,
     sends it over SMS. Re-requesting inside the cooldown is rejected.
  2. `verify_otp` — constant-shape checks (expiry, attempts, hash), burns the
     code on success and returns a short-lived signed *phone-proof token*.
  3. Signup / OTP-login / password-reset endpoints exchange that proof token
     for their respective outcomes. The proof is purpose-bound, so a login
     proof can never be replayed to reset a password.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..integrations import sms
from ..logging import get_logger
from ..models.otp import OtpCode, OtpPurpose
from ..phone import mask_phone
from ..redis import rate_limit
from ..security import make_phone_proof_token

settings = get_settings()
log = get_logger("services.otp")

# Uniform error so callers can't distinguish "wrong code" from "expired" etc.
INVALID_OTP = "invalid or expired code"


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


async def request_otp(db: AsyncSession, *, phone: str, purpose: OtpPurpose) -> None:
    """Issue and send an OTP. Raises 429 on cooldown/rate-limit violations."""
    allowed = await rate_limit(
        f"otp:phone:{phone}", limit=5, window_seconds=15 * 60
    ) and await rate_limit(f"otp:phone:daily:{phone}", limit=20, window_seconds=24 * 3600)
    if not allowed:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "too many codes requested — try again later",
        )

    now = datetime.now(UTC)
    latest = (
        await db.execute(
            select(OtpCode)
            .where(OtpCode.phone == phone, OtpCode.purpose == purpose)
            .order_by(OtpCode.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if (
        latest is not None
        and latest.consumed_at is None
        and (now - latest.created_at).total_seconds() < settings.otp_resend_cooldown_seconds
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"wait {settings.otp_resend_cooldown_seconds}s before requesting another code",
        )

    # Supersede any previous live codes for this phone+purpose.
    await db.execute(
        update(OtpCode)
        .where(
            OtpCode.phone == phone,
            OtpCode.purpose == purpose,
            OtpCode.consumed_at.is_(None),
        )
        .values(consumed_at=now)
    )

    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        OtpCode(
            phone=phone,
            purpose=purpose,
            code_hash=_hash_code(code),
            expires_at=now + timedelta(seconds=settings.otp_ttl_seconds),
        )
    )
    await db.commit()

    sms.send_otp(to=phone, code=code, purpose=purpose.value)
    log.info("otp.requested", phone=mask_phone(phone), purpose=purpose.value)


async def verify_otp(
    db: AsyncSession, *, phone: str, purpose: OtpPurpose, code: str
) -> str:
    """Verify a code; on success burn it and return a phone-proof token."""
    now = datetime.now(UTC)
    row = (
        await db.execute(
            select(OtpCode)
            .where(
                OtpCode.phone == phone,
                OtpCode.purpose == purpose,
                OtpCode.consumed_at.is_(None),
            )
            .order_by(OtpCode.created_at.desc())
            .limit(1)
            .with_for_update()
        )
    ).scalar_one_or_none()

    if row is None or row.expires_at < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_OTP)

    if row.attempts >= settings.otp_max_attempts:
        row.consumed_at = now  # burn it
        await db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_OTP)

    if not secrets.compare_digest(row.code_hash, _hash_code(code)):
        row.attempts += 1
        await db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_OTP)

    row.consumed_at = now
    await db.commit()
    log.info("otp.verified", phone=mask_phone(phone), purpose=purpose.value)
    return make_phone_proof_token(phone=phone, purpose=purpose.value)
