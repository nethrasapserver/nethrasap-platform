"""Inventory admin schemas."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReceiveRequest(BaseModel):
    variant_id: UUID
    warehouse_id: UUID | None = None
    quantity: int = Field(gt=0)
    reorder_point: int | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=500)


class AdjustRequest(BaseModel):
    variant_id: UUID
    warehouse_id: UUID | None = None
    delta: int = Field(description="signed correction; non-zero")
    reason: str = Field(min_length=1, max_length=120)
    note: str | None = Field(default=None, max_length=500)


class StockLevelOut(BaseModel):
    level_id: UUID
    variant_id: UUID
    product_id: UUID
    product_name: str
    pack_size: str
    on_hand: int
    reserved: int
    available: int
    reorder_point: int
    is_low: bool


class LedgerEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    movement: str
    quantity: int
    reason: str | None = None
    ref_type: str | None = None
    ref_id: str | None = None
    note: str | None = None
    created_at: datetime


class WarehouseCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=1, max_length=120)
    city: str | None = None
    state: str | None = None
    pincode: str | None = Field(default=None, max_length=10)


class WarehouseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    city: str | None = None
    state: str | None = None
    is_active: bool
