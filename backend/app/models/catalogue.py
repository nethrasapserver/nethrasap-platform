"""Catalogue — Category, Product, ProductVariant, ProductPrice, ProductImage, Review."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_at, updated_at, uuid_pk


class ScheduleClass(str, enum.Enum):
    NONE = "NONE"
    H = "H"
    H1 = "H1"
    X = "X"


class StockStatus(str, enum.Enum):
    in_stock = "in_stock"
    low_stock = "low_stock"
    out_of_stock = "out_of_stock"
    discontinued = "discontinued"


class PriceRole(str, enum.Enum):
    """Pricing tier — separate from UserRole so portal users can resolve any tier."""

    customer = "customer"
    clinician = "clinician"
    retailer = "retailer"


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid_pk]
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    sku_prefix: Mapped[str] = mapped_column(String(8), nullable=False)
    glyph: Mapped[str | None] = mapped_column(String(50))  # icon name reference
    image_key: Mapped[str | None] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        index=True,
    )

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    products: Mapped[list[Product]] = relationship(back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid_pk]
    slug: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)

    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sub_category: Mapped[str | None] = mapped_column(String(80))

    schedule: Mapped[ScheduleClass] = mapped_column(
        SAEnum(ScheduleClass, name="schedule_class", values_callable=lambda e: [m.value for m in e]),
        default=ScheduleClass.NONE,
        nullable=False,
    )
    hsn_code: Mapped[str | None] = mapped_column(String(12))

    stock_status: Mapped[StockStatus] = mapped_column(
        SAEnum(StockStatus, name="stock_status", values_callable=lambda e: [m.value for m in e]),
        default=StockStatus.in_stock,
        nullable=False,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    badge: Mapped[str | None] = mapped_column(String(50))

    dispatch_sla_hours: Mapped[int | None] = mapped_column(Integer)
    delivery_time_mins: Mapped[int | None] = mapped_column(Integer)

    # GST rate as a whole-percent (12 means 12%). Snapshot to each order line
    # so historical orders retain their tax breakdown even if the rate changes.
    gst_rate_pct: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=12)

    # Denormalised (refreshed by triggers/jobs in later phases)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=0, nullable=False)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Free-form spec rows: list of {label, value} dicts (matches data.js shape)
    specs: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    attributes: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    search_tsv: Mapped[str | None] = mapped_column(TSVECTOR)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    category: Mapped[Category] = relationship(back_populates="products")
    variants: Mapped[list[ProductVariant]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductVariant.sort_order",
    )
    images: Mapped[list[ProductImage]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.sort_order",
    )

    __table_args__ = (
        Index("ix_products_search_tsv", "search_tsv", postgresql_using="gin"),
    )


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id: Mapped[uuid_pk]
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pack_size: Mapped[str] = mapped_column(String(80), nullable=False)
    unit_label: Mapped[str] = mapped_column(String(120), nullable=False)
    barcode: Mapped[str | None] = mapped_column(String(64), unique=True)
    weight_g: Mapped[int | None] = mapped_column(Integer)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    product: Mapped[Product] = relationship(back_populates="variants")
    prices: Mapped[list[ProductPrice]] = relationship(
        back_populates="variant", cascade="all, delete-orphan"
    )


class ProductPrice(Base):
    """Role-aware pricing with validity windows.

    The partial-unique index `uq_product_prices_active` (created in the
    migration) enforces that only one price row may be active (i.e. have
    NULL valid_to) per (variant_id, role) at any time.
    """

    __tablename__ = "product_prices"

    id: Mapped[uuid_pk]
    variant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_variants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[PriceRole] = mapped_column(
        SAEnum(PriceRole, name="price_role", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        index=True,
    )
    mrp: Mapped[int] = mapped_column(Integer, nullable=False)  # paise; render with /100 if needed
    selling_price: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)

    valid_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    variant: Mapped[ProductVariant] = relationship(back_populates="prices")


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[uuid_pk]
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False)
    alt: Mapped[str | None] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    product: Mapped[Product] = relationship(back_populates="images")

    __table_args__ = (
        UniqueConstraint("product_id", "storage_key", name="uq_product_images_product_id_storage_key"),
    )


class Review(Base):
    """Product review.

    One review per (user_id, product_id). The DB-level trigger
    `reviews_recompute_aiud` keeps `products.rating` and `products.reviews_count`
    in sync on every INSERT/UPDATE/DELETE.
    """

    __tablename__ = "reviews"

    id: Mapped[uuid_pk]
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    title: Mapped[str | None] = mapped_column(String(120))
    body: Mapped[str | None] = mapped_column(Text)
    is_verified_purchase: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_reviews_user_id_product_id"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"),
        Index("ix_reviews_product_id_created_at", "product_id", "created_at"),
    )
