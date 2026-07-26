"""Enquiries (RFQ) — quote requests from customers, worked by sales.

Lifecycle: pending → quoted → confirmed → converted (to an order)
                    ↘ rejected
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_at, updated_at, uuid_pk


class EnquiryStatus(str, enum.Enum):
    pending = "pending"      # customer submitted, awaiting a rep
    quoted = "quoted"        # rep priced it; customer to accept
    confirmed = "confirmed"  # customer accepted the quote
    converted = "converted"  # turned into an order
    rejected = "rejected"


class EnquiryApproval(str, enum.Enum):
    """Internal sign-off state for a drafted quote — never shown to the customer.

    A quote a sales rep drafts sits in `pending` until a manager or admin
    releases it; the customer only sees the enquiry move to `quoted` once
    approval lands. `returned` sends it back to the rep to revise.
    """
    none = "none"          # no quote drafted yet
    pending = "pending"    # sales drafted a quote, awaiting manager/admin sign-off
    approved = "approved"  # released to the customer
    returned = "returned"  # sent back to the rep to revise


class Enquiry(Base):
    __tablename__ = "enquiries"

    id: Mapped[uuid_pk]
    reference: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_rep_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[EnquiryStatus] = mapped_column(
        SAEnum(EnquiryStatus, name="enquiry_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=EnquiryStatus.pending,
        server_default=EnquiryStatus.pending.value,
        index=True,
    )
    note: Mapped[str | None] = mapped_column(Text)  # customer's request note

    # Quoted totals (paise) — populated when a rep prices the enquiry.
    quoted_subtotal: Mapped[int | None] = mapped_column(Integer)
    quoted_total: Mapped[int | None] = mapped_column(Integer)
    quote_valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Internal quote sign-off. A sales-drafted quote waits here for a manager or
    # admin to release it; the customer sees nothing until approval.
    approval_status: Mapped[EnquiryApproval] = mapped_column(
        SAEnum(EnquiryApproval, name="enquiry_approval", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=EnquiryApproval.none,
        server_default=EnquiryApproval.none.value,
        index=True,
    )
    quote_prepared_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    quote_approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    quote_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    quote_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # lazy="joined": every enquiry read needs the order number once converted,
    # and a LEFT JOIN is cheaper than N lazy loads across list endpoints.
    converted_order: Mapped["Order | None"] = relationship(  # noqa: F821, UP037
        "Order", foreign_keys="Enquiry.converted_order_id", lazy="joined", viewonly=True
    )
    converted_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL")
    )

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    items: Mapped[list[EnquiryItem]] = relationship(
        back_populates="enquiry", cascade="all, delete-orphan", lazy="selectin"
    )
    messages: Mapped[list[EnquiryMessage]] = relationship(
        back_populates="enquiry",
        cascade="all, delete-orphan",
        order_by="EnquiryMessage.created_at",
        lazy="selectin",
    )
    history: Mapped[list[EnquiryStatusHistory]] = relationship(
        back_populates="enquiry",
        cascade="all, delete-orphan",
        order_by="EnquiryStatusHistory.at",
        lazy="selectin",
    )


class EnquiryItem(Base):
    __tablename__ = "enquiry_items"

    id: Mapped[uuid_pk]
    enquiry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("enquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    variant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False
    )
    product_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    # Rep-quoted unit price (paise); null until quoted.
    quoted_unit_price: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[created_at]

    enquiry: Mapped[Enquiry] = relationship(back_populates="items")


class EnquiryMessage(Base):
    __tablename__ = "enquiry_messages"

    id: Mapped[uuid_pk]
    enquiry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("enquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[created_at]

    enquiry: Mapped[Enquiry] = relationship(back_populates="messages")


class EnquiryStatusHistory(Base):
    __tablename__ = "enquiry_status_history"

    id: Mapped[uuid_pk]
    enquiry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("enquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[EnquiryStatus] = mapped_column(
        SAEnum(EnquiryStatus, name="enquiry_status", create_type=False), nullable=False
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    note: Mapped[str | None] = mapped_column(Text)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    enquiry: Mapped[Enquiry] = relationship(back_populates="history")
