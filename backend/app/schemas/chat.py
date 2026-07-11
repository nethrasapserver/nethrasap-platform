"""Chat schemas."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OpenConversation(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    subject: str | None = Field(default=None, max_length=200)


class SendMessage(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    body: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    id: UUID
    conversation_id: UUID | None = None
    sender_id: UUID | None = None
    body: str
    created_at: datetime


class ConversationOut(BaseModel):
    id: UUID
    customer_id: UUID
    assigned_to: UUID | None = None
    status: str
    subject: str | None = None
    last_message_at: datetime | None = None
    created_at: datetime
    messages: list[MessageOut] | None = None
