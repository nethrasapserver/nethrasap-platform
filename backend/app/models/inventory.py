"""Inventory — warehouses, per-variant stock levels, append-only ledger.

Design:
  * A variant with NO stock_levels row is UNTRACKED — checkout doesn't gate on
    it and `products.stock_status` stays whatever admin set. The first receipt
    creates the row and flips the variant to tracked/enforced.
  * `stock_ledger` is append-only. Summing its signed quantities per movement
    class reconstructs `on_hand` and `reserved` exactly — the levels table is a
    running cache of the ledger, and a test asserts they agree.
"""
from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_at, updated_at, uuid_pk

if TYPE_CHECKING:
    from .catalogue import ProductVariant


class StockMovement(str, enum.Enum):
    receipt = "receipt"            # +on_hand  (stock arrived)
    reservation = "reservation"    # +reserved (order placed)
    release = "release"            # -reserved (order cancelled / payment failed)
    fulfillment = "fulfillment"    # -on_hand -reserved (order dispatched)
    adjustment = "adjustment"      # ±on_hand (manual correction / stocktake)
    return_ = "return"             # +on_hand (customer return restocked)


class Warehouse(Base):
    __tablename__ = "warehouses"

    id: Mapped[uuid_pk]
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    pincode: Mapped[str | None] = mapped_column(String(10))
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, server_default="true")

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]


class StockLevel(Base):
    """Running quantities for one variant in one warehouse.

    available = on_hand - reserved (computed in queries, never stored).
    """

    __tablename__ = "stock_levels"

    id: Mapped[uuid_pk]
    variant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False
    )
    on_hand: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    reserved: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    reorder_point: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    variant: Mapped[ProductVariant] = relationship()

    __table_args__ = (
        UniqueConstraint("variant_id", "warehouse_id", name="uq_stock_levels_variant_warehouse"),
        CheckConstraint("on_hand >= 0", name="ck_stock_levels_on_hand_nonneg"),
        CheckConstraint("reserved >= 0", name="ck_stock_levels_reserved_nonneg"),
        CheckConstraint("reserved <= on_hand", name="ck_stock_levels_reserved_le_on_hand"),
        Index("ix_stock_levels_variant", "variant_id"),
    )


class StockLedger(Base):
    """Append-only record of every quantity change."""

    __tablename__ = "stock_ledger"

    id: Mapped[uuid_pk]
    variant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False
    )
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False
    )
    movement: Mapped[StockMovement] = mapped_column(
        SAEnum(StockMovement, name="stock_movement", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    # Signed quantity. Field affected depends on movement (on_hand vs reserved),
    # resolved by the service; the ledger just records what happened.
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(120))

    ref_type: Mapped[str | None] = mapped_column(String(40))   # e.g. "order"
    ref_id: Mapped[str | None] = mapped_column(String(64))     # e.g. order number
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    note: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[created_at]

    __table_args__ = (
        Index("ix_stock_ledger_variant", "variant_id"),
        Index("ix_stock_ledger_ref", "ref_type", "ref_id"),
    )
