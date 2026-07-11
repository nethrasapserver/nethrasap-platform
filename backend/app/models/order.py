"""Orders, line items, status history, payments, refunds, invoices, shipments.

All money values are stored as integer paise (subdivisions of a rupee).
Convert to rupees only at the API boundary.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_at, updated_at, uuid_pk


class OrderStatus(str, enum.Enum):
    placed = "placed"
    confirmed = "confirmed"
    packed = "packed"
    dispatched = "dispatched"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    cancelled = "cancelled"
    refunded = "refunded"
    payment_failed = "payment_failed"


class PaymentMethod(str, enum.Enum):
    cod = "cod"
    upi = "upi"
    card = "card"
    netbanking = "netbanking"
    wallet = "wallet"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    cod_pending = "cod_pending"
    authorized = "authorized"
    captured = "captured"
    failed = "failed"
    refunded = "refunded"
    partial_refund = "partial_refund"


class RefundStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ShipmentStatus(str, enum.Enum):
    pending = "pending"
    in_transit = "in_transit"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    returned = "returned"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid_pk]
    # Human-readable: NS-2026-00001 — generated server-side, see services/orders.py
    order_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus, name="order_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=OrderStatus.placed,
        index=True,
    )

    # Money totals (paise)
    subtotal: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gst_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shipping_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    grand_total: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)

    # Address is snapshotted as JSON so historical orders stay correct even if
    # the user later deletes/edits the address row. Real address book in Phase 4.
    shipping_address: Mapped[dict] = mapped_column(JSONB, nullable=False)

    # Payment summary at order-level (denormalised; Payment rows are source of truth)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod, name="payment_method", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="payment_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=PaymentStatus.pending,
    )

    coupon_code: Mapped[str | None] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(Text)

    # Idempotency key supplied by the client to deduplicate retries of POST /checkout/place.
    client_request_id: Mapped[str | None] = mapped_column(String(64), unique=True)

    placed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    items: Mapped[list[OrderItem]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderItem.created_at",
    )
    status_history: Mapped[list[OrderStatusHistory]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderStatusHistory.at",
    )
    payments: Mapped[list[Payment]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )
    invoice: Mapped[Invoice | None] = relationship(
        back_populates="order",
        uselist=False,
        cascade="all, delete-orphan",
    )
    shipment: Mapped[Shipment | None] = relationship(
        back_populates="order",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint("grand_total >= 0", name="ck_orders_grand_total_non_negative"),
        CheckConstraint("subtotal >= 0", name="ck_orders_subtotal_non_negative"),
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid_pk]
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    variant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_variants.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Snapshot every renderable bit so historical orders survive product edits.
    product_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    brand_snapshot: Mapped[str] = mapped_column(String(120), nullable=False)
    unit_label_snapshot: Mapped[str] = mapped_column(String(120), nullable=False)
    hsn_code_snapshot: Mapped[str | None] = mapped_column(String(12))

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[int] = mapped_column(Integer, nullable=False)         # paise
    gst_rate_pct: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    gst_amount: Mapped[int] = mapped_column(Integer, nullable=False)         # paise
    line_total: Mapped[int] = mapped_column(Integer, nullable=False)         # paise

    created_at: Mapped[created_at]

    order: Mapped[Order] = relationship(back_populates="items")

    __table_args__ = (
        CheckConstraint("quantity >= 1", name="ck_order_items_quantity_min"),
    )


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id: Mapped[uuid_pk]
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus, name="order_status", create_type=False),
        nullable=False,
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    note: Mapped[str | None] = mapped_column(Text)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    order: Mapped[Order] = relationship(back_populates="status_history")


class Payment(Base):
    """One row per payment attempt. Refunds are tracked in `refunds`."""

    __tablename__ = "payments"

    id: Mapped[uuid_pk]
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod, name="payment_method", create_type=False),
        nullable=False,
    )
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="payment_status", create_type=False),
        nullable=False,
        default=PaymentStatus.pending,
    )

    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # paise
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)

    # Gateway identifiers — Razorpay etc. The webhook handler reads these.
    gateway: Mapped[str | None] = mapped_column(String(40))         # 'razorpay' | 'cod' | 'stub'
    gateway_order_id: Mapped[str | None] = mapped_column(String(80), index=True)
    gateway_payment_id: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    gateway_signature: Mapped[str | None] = mapped_column(String(160))

    raw_response: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    order: Mapped[Order] = relationship(back_populates="payments")


class Refund(Base):
    __tablename__ = "refunds"

    id: Mapped[uuid_pk]
    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # paise
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[RefundStatus] = mapped_column(
        SAEnum(RefundStatus, name="refund_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=RefundStatus.pending,
    )

    gateway_refund_id: Mapped[str | None] = mapped_column(String(80), unique=True)
    raw_response: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid_pk]
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    invoice_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    # Storage key — filled by the (currently stubbed) PDF generator.
    pdf_storage_key: Mapped[str | None] = mapped_column(String(255))
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    order: Mapped[Order] = relationship(back_populates="invoice")


class Shipment(Base):
    __tablename__ = "shipments"

    id: Mapped[uuid_pk]
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    status: Mapped[ShipmentStatus] = mapped_column(
        SAEnum(ShipmentStatus, name="shipment_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=ShipmentStatus.pending,
    )

    courier: Mapped[str | None] = mapped_column(String(80))
    awb_number: Mapped[str | None] = mapped_column(String(64), index=True)
    tracking_url: Mapped[str | None] = mapped_column(String(512))

    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    eta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    order: Mapped[Order] = relationship(back_populates="shipment")
