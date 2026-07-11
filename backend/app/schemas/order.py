"""Order schemas — list + detail + tracking."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from .checkout import ShippingAddress


class OrderLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    variant_id: UUID
    product_name: str = Field(validation_alias="product_name_snapshot")
    brand: str = Field(validation_alias="brand_snapshot")
    unit_label: str = Field(validation_alias="unit_label_snapshot")
    hsn_code: str | None = Field(default=None, validation_alias="hsn_code_snapshot")
    quantity: int
    unit_price: int
    gst_rate_pct: int
    gst_amount: int
    line_total: int


class OrderStatusEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    status: str
    note: str | None = None
    at: datetime


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    method: str
    status: str
    amount: int
    currency: str
    gateway: str | None = None
    gateway_payment_id: str | None = None
    captured_at: datetime | None = None
    failed_at: datetime | None = None


class ShipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    status: str
    courier: str | None = None
    awb_number: str | None = None
    tracking_url: str | None = None
    dispatched_at: datetime | None = None
    delivered_at: datetime | None = None
    eta: datetime | None = None


class OrderListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_number: str
    status: str
    payment_status: str
    payment_method: str
    grand_total: int
    currency: str
    item_count: int
    placed_at: datetime


class OrderDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_number: str
    status: str
    payment_status: str
    payment_method: str

    subtotal: int
    discount_total: int
    gst_total: int
    shipping_total: int
    grand_total: int
    currency: str

    shipping_address: ShippingAddress
    coupon_code: str | None = None
    notes: str | None = None

    placed_at: datetime
    confirmed_at: datetime | None = None
    cancelled_at: datetime | None = None
    delivered_at: datetime | None = None

    items: list[OrderLineOut] = []
    status_history: list[OrderStatusEventOut] = []
    payments: list[PaymentOut] = []
    shipment: ShipmentOut | None = None


class CancelOrderRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class TrackOrderPublic(BaseModel):
    """Public-facing order summary — order-tracking page (anonymous OK)."""
    order_number: str
    status: str
    grand_total: int
    currency: str = "INR"
    item_count: int
    placed_at: datetime
    timeline: list[OrderStatusEventOut]
    shipment: ShipmentOut | None = None
