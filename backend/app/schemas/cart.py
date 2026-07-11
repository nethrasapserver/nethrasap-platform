"""Cart + Coupon schemas."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CartItemAdd(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    variant_id: UUID
    quantity: int = Field(default=1, ge=1, le=999)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1, le=999)


class CartItemProduct(BaseModel):
    """Lightweight product summary embedded in cart-line responses."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    brand: str
    unit_label: str
    stock_status: str
    image_storage_key: str | None = None


class CartItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    variant_id: UUID
    quantity: int
    unit_price: int                 # paise
    gst_rate_pct: int
    line_subtotal: int              # paise
    product: CartItemProduct


class CartTotals(BaseModel):
    subtotal: int       # paise (sum of line_subtotal)
    discount: int       # paise (positive number to subtract)
    gst: int            # paise
    shipping: int       # paise (Phase-3 estimate; actual computed at checkout)
    grand_total: int    # paise
    currency: str = "INR"


class AppliedCoupon(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    code: str
    type: str
    value: int
    discount: int   # paise — what this coupon takes off the current cart


class CartOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID | None = None
    session_id: str | None = None
    items: list[CartItemOut] = []
    totals: CartTotals
    coupon: AppliedCoupon | None = None
    currency: str = "INR"
    updated_at: datetime


class CouponApply(BaseModel):
    code: str = Field(min_length=1, max_length=40)
