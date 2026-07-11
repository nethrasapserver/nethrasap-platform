"""Coupon schemas — used for admin/public lookups."""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CouponOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    type: Literal["percent", "flat"]
    value: int
    min_order: int
    max_uses: int | None = None
    used_count: int
    is_active: bool
    expires_at: datetime | None = None
