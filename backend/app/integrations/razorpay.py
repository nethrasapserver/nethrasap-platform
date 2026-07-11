"""Razorpay client — real when credentials are set, deterministic stub otherwise.

`is_configured()` gates the two modes so local dev and the test suite exercise
the entire payment flow (create order → confirm → refund) on the stub, and
production talks to the real API by only changing env vars. The HMAC signature
helpers are identical in both modes — the webhook/confirm handlers never branch.
"""
from __future__ import annotations

import hmac
import secrets
from hashlib import sha256
from typing import Any

import httpx

from ..config import get_settings
from ..logging import get_logger

log = get_logger("integrations.razorpay")

API_BASE = "https://api.razorpay.com/v1"


def is_configured() -> bool:
    s = get_settings()
    return bool(s.razorpay_key_id and s.razorpay_key_secret)


def key_id() -> str | None:
    """Public key id for the client-side Checkout modal (safe to expose)."""
    return get_settings().razorpay_key_id or None


def _client() -> httpx.Client:
    s = get_settings()
    return httpx.Client(
        base_url=API_BASE,
        auth=(s.razorpay_key_id, s.razorpay_key_secret),
        timeout=20.0,
    )


# --- Orders ------------------------------------------------------------------


def create_order(amount_paise: int, *, receipt: str, notes: dict[str, Any] | None = None) -> dict[str, Any]:
    """Create a gateway order; returns the Razorpay order object (or a stub)."""
    if not is_configured():
        fake_id = "order_stub_" + secrets.token_hex(8)
        log.info("razorpay.create_order.stub", amount_paise=amount_paise, receipt=receipt, order_id=fake_id)
        return {
            "id": fake_id,
            "entity": "order",
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "status": "created",
            "notes": notes or {},
        }
    with _client() as c:
        resp = c.post(
            "/orders",
            json={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": receipt,
                "notes": notes or {},
            },
        )
        resp.raise_for_status()
        return resp.json()


def fetch_payment(payment_id: str) -> dict[str, Any]:
    if not is_configured():
        return {"id": payment_id, "status": "captured", "entity": "payment"}
    with _client() as c:
        resp = c.get(f"/payments/{payment_id}")
        resp.raise_for_status()
        return resp.json()


def refund(payment_id: str, *, amount_paise: int, notes: dict[str, Any] | None = None) -> dict[str, Any]:
    """Refund a captured payment (full or partial)."""
    if not is_configured():
        fake_id = "rfnd_stub_" + secrets.token_hex(8)
        log.info("razorpay.refund.stub", payment_id=payment_id, amount_paise=amount_paise, refund_id=fake_id)
        return {
            "id": fake_id,
            "entity": "refund",
            "amount": amount_paise,
            "payment_id": payment_id,
            "status": "processed",
        }
    with _client() as c:
        resp = c.post(f"/payments/{payment_id}/refund", json={"amount": amount_paise, "notes": notes or {}})
        resp.raise_for_status()
        return resp.json()


# --- Signature verification (mode-independent) --------------------------------


def verify_webhook_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    """Verify the `X-Razorpay-Signature` header on a webhook POST."""
    digest = hmac.new(secret.encode("utf-8"), raw_body, sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def verify_checkout_signature(*, order_id: str, payment_id: str, signature: str) -> bool:
    """Verify the handshake the Checkout modal returns to the client:
    HMAC-SHA256 of `order_id|payment_id` with the key secret."""
    secret = get_settings().razorpay_key_secret
    if not secret:
        # Stub mode: accept the deterministic signature our own stub produces
        # (see stub_checkout_signature) so the confirm flow is testable.
        return signature == stub_checkout_signature(order_id=order_id, payment_id=payment_id)
    digest = hmac.new(secret.encode("utf-8"), f"{order_id}|{payment_id}".encode(), sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def stub_checkout_signature(*, order_id: str, payment_id: str) -> str:
    """Deterministic signature used in stub mode (no real secret)."""
    return sha256(f"stub|{order_id}|{payment_id}".encode()).hexdigest()
