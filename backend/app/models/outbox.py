"""Transactional outbox for background jobs.

A `job_outbox` row is inserted in the SAME transaction as the business write
that wants a job enqueued, so a crash between commit and arq-enqueue can never
lose work: the periodic worker sweep re-dispatches any row still `pending`.
Rows that fail dispatch 10+ times are parked as `failed` (dead-letter) for
manual inspection.
"""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, created_at, uuid_pk


class OutboxStatus(str, enum.Enum):
    pending = "pending"
    dispatched = "dispatched"
    failed = "failed"


class JobOutbox(Base):
    __tablename__ = "job_outbox"
    __table_args__ = (Index("ix_job_outbox_status_created_at", "status", "created_at"),)

    id: Mapped[uuid_pk]
    task_name: Mapped[str] = mapped_column(String(120), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[OutboxStatus] = mapped_column(
        SAEnum(OutboxStatus, name="job_outbox_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=OutboxStatus.pending,
        server_default=OutboxStatus.pending.value,
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_error: Mapped[str | None] = mapped_column(Text)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[created_at]
