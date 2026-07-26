"""Saved items — wishlist + compare tray.

Both are per-user product references, server-side so they roam across
devices and sync in realtime over the user's WS channel (the demo kept
these in localStorage; the platform persists them properly).

Wishlist is unbounded; the compare tray is capped (service-enforced,
COMPARE_MAX) because the comparison table renders side-by-side columns.
"""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, created_at, uuid_pk


class WishlistItem(Base):
    __tablename__ = "wishlist_items"

    id: Mapped[uuid_pk]
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[created_at]

    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_wishlist_items_user_id_product_id"),
    )


class CompareItem(Base):
    __tablename__ = "compare_items"

    id: Mapped[uuid_pk]
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[created_at]

    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_compare_items_user_id_product_id"),
    )
