"""Live chat — customer ↔ sales/manager. Replaces the demo's scripted chatbot.

A customer has at most one open conversation. Staff pick up unassigned
conversations from an inbox. Messages fan out over the conv:{id} channel.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_at, updated_at, uuid_pk


class ConversationStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid_pk]
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[ConversationStatus] = mapped_column(
        SAEnum(
            ConversationStatus, name="conversation_status", values_callable=lambda e: [m.value for m in e]
        ),
        nullable=False,
        default=ConversationStatus.open,
        server_default=ConversationStatus.open.value,
        index=True,
    )
    subject: Mapped[str | None] = mapped_column(String(200))
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    messages: Mapped[list[Message]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid_pk]
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[created_at]

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class MessageRead(Base):
    """Per-user read cursor for a conversation (last read message timestamp)."""

    __tablename__ = "message_reads"

    id: Mapped[uuid_pk]
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    last_read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_message_reads_conv_user"),
    )
