"""Payment-method availability — the single authority on what checkout offers.

The full method registry stays defined (models, schemas and the Payment table
already understand every method); *availability* is config-driven via
`PAYMENT_METHODS_ENABLED`. COD-only at launch — enabling UPI/card/netbanking
later is an env change plus the storefront gateway modal, not a code path.

Settings are read lazily on every call so tests can adjust the cached
Settings instance without re-importing modules.
"""
from __future__ import annotations

from typing import Any, Literal

from fastapi import HTTPException, status

from ..config import get_settings
from ..logging import get_logger

log = get_logger("services.payment_methods")

MethodKind = Literal["offline", "gateway"]

# Ordered registry — the storefront renders methods in this order.
METHOD_REGISTRY: dict[str, dict[str, Any]] = {
    "cod": {
        "label": "Cash on delivery",
        "kind": "offline",
        "description": "Pay in cash or by UPI to the rider when your order arrives.",
    },
    "upi": {
        "label": "UPI",
        "kind": "gateway",
        "description": "Pay instantly with any UPI app.",
    },
    "card": {
        "label": "Credit / debit card",
        "kind": "gateway",
        "description": "Visa, Mastercard, RuPay and Amex.",
    },
    "netbanking": {
        "label": "Netbanking",
        "kind": "gateway",
        "description": "All major Indian banks.",
    },
    "wallet": {
        "label": "Wallet",
        "kind": "gateway",
        "description": "Popular wallet providers.",
    },
}

DEFAULT_METHOD = "cod"


def enabled_methods() -> list[str]:
    """Configured methods, registry-ordered; unknown entries are logged and
    dropped so a typo in env can never widen what checkout accepts."""
    configured = set(get_settings().payment_methods_enabled_list)
    unknown = configured - METHOD_REGISTRY.keys()
    if unknown:
        log.warning("payment_methods.unknown_configured", methods=sorted(unknown))
    return [m for m in METHOD_REGISTRY if m in configured]


def available_methods() -> list[dict[str, Any]]:
    """Shape consumed by `GET /checkout/payment-methods`."""
    return [
        {"id": m, **{k: v for k, v in METHOD_REGISTRY[m].items()}}
        for m in enabled_methods()
    ]


def default_method() -> str:
    enabled = enabled_methods()
    return DEFAULT_METHOD if DEFAULT_METHOD in enabled else (enabled[0] if enabled else DEFAULT_METHOD)


def ensure_enabled(method: str) -> None:
    """400 for anything checkout is not currently offering."""
    if method not in METHOD_REGISTRY:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid payment_method: {method}")
    if method not in enabled_methods():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"payment method '{method}' is not available — choose one of: "
            + ", ".join(enabled_methods()),
        )
