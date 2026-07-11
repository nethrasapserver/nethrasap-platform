"""Live chat — customer ↔ sales/manager. Replaces the demo's scripted chatbot.

A customer has at most one open conversation (reused across visits). Staff pick
unassigned conversations from an inbox, claim, reply, and close. Messages fan
out over the conv:{id} channel and drop an in-app notification to the other party.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..logging import get_logger
from ..models.chat import Conversation, ConversationStatus, Message
from ..models.user import User, UserRole
from ..realtime import publish_event
from ..realtime.channels import conversation_channel, role_channel
from . import notifications as notify_svc
from .notifications import NotificationType

log = get_logger("services.chat")

STAFF_ROLES = (UserRole.sales, UserRole.manager, UserRole.admin)


def _is_staff(user: User) -> bool:
    return user.role in STAFF_ROLES


async def _load(db: AsyncSession, conversation_id: uuid.UUID) -> Conversation:
    conv = (
        await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    ).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation not found")
    return conv


def _ensure_participant(conv: Conversation, user: User) -> None:
    if conv.customer_id == user.id or _is_staff(user):
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "not a participant")


# --- Customer -----------------------------------------------------------------


async def open_conversation(db: AsyncSession, customer: User, *, subject: str | None) -> Conversation:
    """Return the customer's open conversation, creating one if none exists."""
    existing = (
        await db.execute(
            select(Conversation).where(
                Conversation.customer_id == customer.id,
                Conversation.status == ConversationStatus.open,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    conv = Conversation(customer_id=customer.id, subject=subject)
    db.add(conv)
    await db.commit()
    return await _load(db, conv.id)


async def send_message(db: AsyncSession, user: User, *, conversation_id: uuid.UUID, body: str) -> dict[str, Any]:
    conv = await _load(db, conversation_id)
    _ensure_participant(conv, user)
    if conv.status == ConversationStatus.closed:
        # A customer message reopens; staff cannot post to a closed thread.
        if conv.customer_id == user.id:
            conv.status = ConversationStatus.open
        else:
            raise HTTPException(status.HTTP_409_CONFLICT, "conversation is closed")

    now = datetime.now(UTC)
    msg = Message(conversation_id=conv.id, sender_id=user.id, body=body)
    db.add(msg)
    conv.last_message_at = now
    await db.flush()

    # Realtime to the conversation channel + alert the other side.
    await publish_event(
        conversation_channel(str(conv.id)),
        type="chat.message",
        entity="message",
        entity_id=str(msg.id),
        payload={"conversation_id": str(conv.id), "sender_id": str(user.id), "body": body},
    )
    if conv.customer_id == user.id:
        # Customer wrote → alert assignee, or the sales pool if unassigned.
        if conv.assigned_to:
            await notify_svc.notify(
                db, user_id=conv.assigned_to, type=NotificationType.chat,
                title="New chat message", link=f"/chat/{conv.id}",
            )
        else:
            await publish_event(
                [role_channel("sales"), role_channel("manager")],
                type="chat.unassigned", entity="conversation", entity_id=str(conv.id),
                payload={"conversation_id": str(conv.id)},
            )
    else:
        await notify_svc.notify(
            db, user_id=conv.customer_id, type=NotificationType.chat,
            title="Support replied", link=f"/chat/{conv.id}",
        )
    await db.commit()
    return {"id": msg.id, "conversation_id": conv.id, "sender_id": user.id, "body": body, "created_at": now}


async def messages(db: AsyncSession, user: User, *, conversation_id: uuid.UUID) -> dict[str, Any]:
    conv = (
        await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conversation_id)
        )
    ).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation not found")
    _ensure_participant(conv, user)
    return _serialise(conv, with_messages=True)


# --- Staff --------------------------------------------------------------------


async def inbox(db: AsyncSession, staff: User, *, scope: str) -> list[dict[str, Any]]:
    """scope: 'unassigned' | 'mine' | 'all' (open conversations)."""
    stmt = select(Conversation).where(Conversation.status == ConversationStatus.open)
    if scope == "unassigned":
        stmt = stmt.where(Conversation.assigned_to.is_(None))
    elif scope == "mine":
        stmt = stmt.where(Conversation.assigned_to == staff.id)
    stmt = stmt.order_by(Conversation.last_message_at.desc().nullslast())
    rows = (await db.execute(stmt)).scalars().unique()
    return [_serialise(c) for c in rows]


async def claim(db: AsyncSession, staff: User, *, conversation_id: uuid.UUID) -> dict[str, Any]:
    conv = await _load(db, conversation_id)
    if conv.assigned_to and conv.assigned_to != staff.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "already claimed by another rep")
    conv.assigned_to = staff.id
    await db.commit()
    return _serialise(await _load(db, conversation_id))


async def close(db: AsyncSession, staff: User, *, conversation_id: uuid.UUID) -> dict[str, Any]:
    conv = await _load(db, conversation_id)
    conv.status = ConversationStatus.closed
    await notify_svc.notify(
        db, user_id=conv.customer_id, type=NotificationType.chat,
        title="Support conversation closed", link=f"/chat/{conv.id}",
    )
    await db.commit()
    return _serialise(await _load(db, conversation_id))


# --- Serialisation ------------------------------------------------------------


def _serialise(conv: Conversation, *, with_messages: bool = False) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": conv.id,
        "customer_id": conv.customer_id,
        "assigned_to": conv.assigned_to,
        "status": conv.status.value,
        "subject": conv.subject,
        "last_message_at": conv.last_message_at,
        "created_at": conv.created_at,
    }
    if with_messages:
        data["messages"] = [
            {"id": m.id, "sender_id": m.sender_id, "body": m.body, "created_at": m.created_at}
            for m in conv.messages
        ]
    return data


async def customer_open_conversation_ids(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    """Conversation channel names this user may subscribe to (for WS auth)."""
    rows = (
        await db.execute(
            select(Conversation.id).where(Conversation.customer_id == user_id)
        )
    ).scalars()
    return [str(cid) for cid in rows]


async def _unread_helper(db: AsyncSession, conv_id: uuid.UUID) -> int:  # reserved for read cursors
    return (
        await db.execute(select(func.count(Message.id)).where(Message.conversation_id == conv_id))
    ).scalar_one()
