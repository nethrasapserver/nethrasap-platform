"""In-app notifications — one row per user per event, pushed over WS."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, created_at, uuid_pk


class NotificationType(str, enum.Enum):
    order = "order"
    enquiry = "enquiry"
    chat = "chat"
    verification = "verification"
    system = "system"


class NotificationPriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid_pk]
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[NotificationType] = mapped_column(
        SAEnum(NotificationType, name="notification_type", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    priority: Mapped[NotificationPriority] = mapped_column(
        SAEnum(
            NotificationPriority,
            name="notification_priority",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=NotificationPriority.normal,
        server_default=NotificationPriority.normal.value,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(255))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[created_at]
