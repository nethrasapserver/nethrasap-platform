"""Razorpay client — **STUB** for Phase 3 backend-only build.

When the user picks a non-COD payment method, the checkout service needs a
gateway `order_id` to hand to the frontend's Razorpay Checkout SDK. In this
stub we generate a deterministic id and log the would-be API call so the
rest of the flow can be exercised without a Razorpay test account.

# TODO(phase-3.5): replace bodies with the real `razorpay` Python client.
#   import razorpay
#   client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
#   return client.order.create({...})
"""
from __future__ import annotations

import hmac
import secrets
from hashlib import sha256
from typing import Any

from ..logging import get_logger

log = get_logger("integrations.razorpay")


def is_configured() -> bool:
    """True once real Razorpay credentials are wired up."""
    return False  # flip when settings.razorpay_key_id is set


def create_order(amount_paise: int, *, receipt: str, notes: dict[str, Any] | None = None) -> dict[str, Any]:
    """Stub: returns a fake `razorpay_order_id` shaped like the real one.

    Real shape (from Razorpay docs):
      { "id": "order_…", "entity": "order", "amount": …, "currency": "INR",
        "receipt": …, "status": "created", "attempts": 0, "notes": {…},
        "created_at": <epoch> }
    """
    fake_id = "order_stub_" + secrets.token_hex(8)
    log.info(
        "razorpay.create_order.stub",
        amount_paise=amount_paise,
        receipt=receipt,
        fake_order_id=fake_id,
        notes=notes or {},
        message="Phase-3 stub. Real Razorpay client lands in Phase 3.5.",
    )
    return {
        "id": fake_id,
        "entity": "order",
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "status": "created",
        "notes": notes or {},
    }


def verify_webhook_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    """HMAC-SHA256 verification. The real signature is calculated by Razorpay
    and shipped in the `X-Razorpay-Signature` header. Stub is identical math —
    we keep the real algorithm so the webhook handler doesn't need to change
    when we flip from stub to real."""
    digest = hmac.new(secret.encode("utf-8"), raw_body, sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def refund(payment_id: str, *, amount_paise: int, notes: dict[str, Any] | None = None) -> dict[str, Any]:
    """Stub refund — returns a fake refund id. Real flow goes through
    `client.payment.refund(payment_id, {...})`."""
    fake_id = "rfnd_stub_" + secrets.token_hex(8)
    log.info(
        "razorpay.refund.stub",
        payment_id=payment_id,
        amount_paise=amount_paise,
        fake_refund_id=fake_id,
        notes=notes or {},
    )
    return {
        "id": fake_id,
        "entity": "refund",
        "amount": amount_paise,
        "payment_id": payment_id,
        "status": "processed",
    }
