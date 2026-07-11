"""Review request/response schemas."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReviewAuthor(BaseModel):
    """Public-facing author identity. Email and exact role are not exposed."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    role: str  # e.g. "customer", "clinician", "retailer" — read-only label


class ReviewCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, max_length=120)
    body: str | None = Field(default=None, max_length=4000)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    rating: int
    title: str | None = None
    body: str | None = None
    is_verified_purchase: bool = False
    created_at: datetime
    updated_at: datetime
    author: ReviewAuthor
