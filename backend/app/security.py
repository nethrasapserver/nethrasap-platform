"""Password hashing + JWT issuance & validation.

- Passwords: Argon2id via passlib.
- Access tokens: short-lived JWTs (default 15 min), stateless.
- Refresh tokens: long-lived opaque random strings; only their SHA-256 hash
  is persisted, and they rotate on every refresh with reuse detection.
"""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from .config import get_settings

_settings = get_settings()
_pwd_ctx = CryptContext(schemes=["argon2"], deprecated="auto")


# --- Passwords --------------------------------------------------------------


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_ctx.verify(plain, hashed)
    except Exception:
        return False


# --- Access tokens (JWT) ----------------------------------------------------


def make_access_token(
    *,
    sub: str,
    role: str,
    kyc_status: str,
    permissions: list[str],
    permission_version: int = 0,
) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": sub,
        "typ": "access",
        "role": role,
        "kyc": kyc_status,
        "perm": permissions,
        # Role-permission version at issue time. require_permission compares it
        # against Redis; a mismatch (role was edited) forces a token refresh.
        "pv": permission_version,
        "iat": now,
        "exp": now + timedelta(minutes=_settings.access_token_ttl_min),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, _settings.jwt_secret, algorithm=_settings.jwt_alg)


def decode_access_token(token: str) -> dict[str, Any]:
    payload = jwt.decode(
        token,
        _settings.jwt_secret,
        algorithms=[_settings.jwt_alg],
        options={"require": ["exp", "sub"]},
    )
    # A phone-proof (or any non-access) token must never authenticate as a
    # user session, even though it is signed with the same secret.
    if payload.get("typ") != "access":
        raise jwt.InvalidTokenError("not an access token")
    return payload


# --- Phone-proof tokens -------------------------------------------------------
# Short-lived JWTs proving "this caller just completed an OTP for this phone,
# for this purpose". Purpose-bound so a login proof can't reset a password.

PHONE_PROOF_TTL_MIN = 10


def make_phone_proof_token(*, phone: str, purpose: str) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": phone,
        "typ": "phone_proof",
        "pur": purpose,
        "iat": now,
        "exp": now + timedelta(minutes=PHONE_PROOF_TTL_MIN),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, _settings.jwt_secret, algorithm=_settings.jwt_alg)


def decode_phone_proof_token(token: str, *, expected_purpose: str) -> str:
    """Validate a phone-proof token; returns the proven phone number."""
    payload = jwt.decode(
        token,
        _settings.jwt_secret,
        algorithms=[_settings.jwt_alg],
        options={"require": ["exp", "sub"]},
    )
    if payload.get("typ") != "phone_proof" or payload.get("pur") != expected_purpose:
        raise jwt.InvalidTokenError("wrong token type or purpose")
    return str(payload["sub"])


# --- Refresh tokens (opaque) ------------------------------------------------


def make_refresh_token() -> tuple[str, str]:
    """Generate a refresh token.

    Returns:
        (raw_token, sha256_hex) — send `raw_token` to the client, store
        `sha256_hex` in the database. We can verify a presented token by
        re-hashing it without ever storing the secret.
    """
    raw = secrets.token_urlsafe(48)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return raw, digest


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(days=_settings.refresh_token_ttl_days)
