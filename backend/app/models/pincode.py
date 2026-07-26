"""Pincode → locality cache.

A lookup result per Indian PIN, cached the first time it's resolved so repeat
checkouts are instant and the platform doesn't hammer an external postal API.
The `city` is a best-guess locality; the customer can always edit it.
"""
from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, created_at, updated_at


class Pincode(Base):
    __tablename__ = "pincodes"

    # The 6-digit PIN is the natural key.
    pincode: Mapped[str] = mapped_column(String(6), primary_key=True)
    city: Mapped[str] = mapped_column(String(120), nullable=False)
    district: Mapped[str] = mapped_column(String(120), nullable=False)
    state: Mapped[str] = mapped_column(String(120), nullable=False)
    # Where the row came from — "india_post" (fetched) or "seed"/"manual".
    source: Mapped[str] = mapped_column(String(20), default="india_post", nullable=False)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]
