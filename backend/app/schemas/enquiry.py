"""Enquiry (RFQ) schemas."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EnquiryItemInput(BaseModel):
    variant_id: UUID
    quantity: int = Field(gt=0, le=100000)


class EnquiryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    items: list[EnquiryItemInput] = Field(min_length=1)
    note: str | None = Field(default=None, max_length=1000)


class MessageInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    body: str = Field(min_length=1, max_length=4000)


class QuoteLine(BaseModel):
    item_id: UUID
    unit_price: int = Field(gt=0)


class QuoteInput(BaseModel):
    lines: list[QuoteLine] = Field(min_length=1)
    valid_days: int = Field(default=7, ge=1, le=90)


class AssignInput(BaseModel):
    rep_id: UUID | None = None


class RejectInput(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class EnquiryItemOut(BaseModel):
    id: UUID
    variant_id: UUID
    product_name: str
    quantity: int
    quoted_unit_price: int | None = None


class EnquiryOut(BaseModel):
    id: UUID
    reference: str
    status: str
    customer_id: UUID
    assigned_rep_id: UUID | None = None
    note: str | None = None
    quoted_subtotal: int | None = None
    quoted_total: int | None = None
    quote_valid_until: datetime | None = None
    converted_order_id: UUID | None = None
    created_at: datetime
    items: list[EnquiryItemOut] = []
    messages: list[dict] | None = None
    history: list[dict] | None = None
