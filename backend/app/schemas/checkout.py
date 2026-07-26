"""Checkout schemas — quote + place order."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .cart import CartTotals


class ShippingAddress(BaseModel):
    """Inline address payload — full address-book CRUD lands in Phase 4."""
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=10, max_length=15)
    line1: str = Field(min_length=1, max_length=255)
    line2: str | None = Field(default=None, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    # Auto-filled from the pincode; optional so older clients still validate.
    district: str | None = Field(default=None, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    pincode: str = Field(min_length=6, max_length=10)
    country: str = Field(default="IN", min_length=2, max_length=2)


PaymentMethodLiteral = Literal["cod", "upi", "card", "netbanking", "wallet"]


class PaymentMethodInfo(BaseModel):
    """One method the storefront may offer at checkout."""

    id: PaymentMethodLiteral
    label: str
    kind: Literal["offline", "gateway"]
    description: str | None = None


class PaymentMethodsResponse(BaseModel):
    """Availability is config-driven (`PAYMENT_METHODS_ENABLED`) — the
    storefront renders exactly this list, never a hardcoded one."""

    methods: list[PaymentMethodInfo]
    default: PaymentMethodLiteral


class QuoteRequest(BaseModel):
    address: ShippingAddress
    payment_method: PaymentMethodLiteral


class QuoteResponse(BaseModel):
    totals: CartTotals
    payment_method: PaymentMethodLiteral
    cold_chain: bool = False
    notes: list[str] = []
    # When the live price differs from the cart snapshot the API surfaces a
    # short list of human messages so the frontend can show a banner.
    price_changes: list[str] = []


class PlaceOrderRequest(BaseModel):
    address: ShippingAddress
    payment_method: PaymentMethodLiteral
    # UUID-ish client-side request id — dedupes accidental double-submits.
    client_request_id: str = Field(min_length=8, max_length=64)
    notes: str | None = Field(default=None, max_length=500)


class PaymentGatewayHandshake(BaseModel):
    """Returned only when the caller picked a non-COD method.

    The frontend feeds these fields to the Razorpay Checkout SDK. In Phase 3
    backend-only the gateway integration is stubbed — these values are
    deterministic mocks so the order placement flow works end-to-end without
    contacting Razorpay.
    """
    gateway: str
    gateway_key_id: str | None = None
    gateway_order_id: str
    amount: int
    currency: str = "INR"


class PlaceOrderResponse(BaseModel):
    order_number: str
    status: str
    payment_status: str
    grand_total: int
    currency: str = "INR"
    gateway: PaymentGatewayHandshake | None = None
