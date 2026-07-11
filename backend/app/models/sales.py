"""Sales org — rep↔customer assignments and per-rep revenue targets.

Assignments give reps their book of accounts (drives 'my orders/enquiries'
and rep performance). Targets are period revenue goals for attainment %.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, created_at, updated_at, uuid_pk


class SalesAssignment(Base):
    """A customer assigned to a sales rep. Ended (unassigned) by setting
    ended_at rather than deleting, so historical attribution survives."""

    __tablename__ = "sales_assignments"

    id: Mapped[uuid_pk]
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rep_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    __table_args__ = (
        # At most one ACTIVE assignment per customer is enforced in the service
        # (a partial unique index would need ended_at IS NULL; kept in code for
        # clarity alongside the reassign flow).
        UniqueConstraint("customer_id", "rep_id", "started_at", name="uq_sales_assignment_span"),
    )


class SalesTarget(Base):
    __tablename__ = "sales_targets"

    id: Mapped[uuid_pk]
    rep_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Period is a month, identified by its first day (e.g. 2026-07-01).
    period: Mapped[date] = mapped_column(Date, nullable=False)
    target_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    label: Mapped[str | None] = mapped_column(String(50))

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    __table_args__ = (
        UniqueConstraint("rep_id", "period", name="uq_sales_target_rep_period"),
    )
