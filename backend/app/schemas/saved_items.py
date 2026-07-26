"""Saved-items schemas — wishlist + compare tray responses."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from .product import ProductListItem


class SavedItemOut(BaseModel):
    """One saved product, rendered with the caller's role-aware pricing."""

    product: ProductListItem
    added_at: datetime


class WishlistOut(BaseModel):
    items: list[SavedItemOut] = []
    product_ids: list[UUID] = []
    count: int = 0


class CompareOut(BaseModel):
    items: list[SavedItemOut] = []
    product_ids: list[UUID] = []
    count: int = 0
    max_items: int
