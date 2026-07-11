"""Cart + Coupon — Phase 3 commerce layer.

Carts are keyed by `user_id` for logged-in users, or by `session_id` for
anonymous shoppers. The DB-level check constraint enforces "at least one of
the two must be set", and the session cookie merge runs on signup/login.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_at, updated_at, uuid_pk


class CouponType(str, enum.Enum):
    percent = "percent"
    flat = "flat"


class Cart(Base):
    __tablename__ = "carts"

    id: Mapped[uuid_pk]
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    # 32-char random token stored in the `nethrasap.session` cookie.
    session_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)

    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    coupon_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coupons.id", ondelete="SET NULL"),
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    items: Mapped[list[CartItem]] = relationship(
        back_populates="cart",
        cascade="all, delete-orphan",
        order_by="CartItem.created_at",
    )
    coupon: Mapped[Coupon | None] = relationship(lazy="joined")

    __table_args__ = (
        CheckConstraint(
            "user_id IS NOT NULL OR session_id IS NOT NULL",
            name="ck_carts_user_or_session",
        ),
    )


class CartItem(Base):
    __tablename__ = "cart_items"

    id: Mapped[uuid_pk]
    cart_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("carts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    variant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_variants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    # Snapshots — guard against price/GST drift between add-to-cart and checkout.
    unit_price_snapshot: Mapped[int] = mapped_column(Integer, nullable=False)  # paise
    gst_rate_pct_snapshot: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    currency_snapshot: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    cart: Mapped[Cart] = relationship(back_populates="items")

    __table_args__ = (
        UniqueConstraint("cart_id", "variant_id", name="uq_cart_items_cart_id_variant_id"),
        CheckConstraint("quantity >= 1", name="ck_cart_items_quantity_min"),
    )


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[uuid_pk]
    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    type: Mapped[CouponType] = mapped_column(
        SAEnum(CouponType, name="coupon_type", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    # For `percent`: integer percent points (10 = 10% off).
    # For `flat`: amount in paise (5000 = ₹50 off).

    min_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_uses: Mapped[int | None] = mapped_column(Integer)
    used_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]
