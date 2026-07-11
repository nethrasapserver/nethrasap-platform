"""Notifications — the single helper every domain calls to alert a user.

`notify()` persists a row AND pushes it over the user's WS channel in one call,
so no service ever hand-rolls notification delivery. Callers pass an open
session; notify() flushes but does not commit (it joins the caller's txn),
except `notify_committed` which manages its own session for fire-and-forget use.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..logging import get_logger
from ..models.notification import Notification, NotificationPriority, NotificationType
from ..realtime import publish_event
from ..realtime.channels import user_channel

log = get_logger("services.notifications")


async def notify(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: NotificationType | str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    priority: NotificationPriority | str = NotificationPriority.normal,
) -> Notification:
    """Create a notification and push it. Joins the caller's transaction."""
    n = Notification(
        user_id=user_id,
        type=NotificationType(type) if isinstance(type, str) else type,
        priority=NotificationPriority(priority) if isinstance(priority, str) else priority,
        title=title,
        body=body,
        link=link,
    )
    db.add(n)
    await db.flush()
    await publish_event(
        user_channel(str(user_id)),
        type="notification.created",
        entity="notification",
        entity_id=str(n.id),
        payload={"title": title, "notification_type": n.type.value, "link": link},
    )
    return n


async def list_for_user(
    db: AsyncSession, *, user_id: uuid.UUID, unread_only: bool, limit: int, offset: int
) -> list[dict[str, Any]]:
    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    rows = (await db.execute(stmt)).scalars()
    return [
        {
            "id": n.id,
            "type": n.type.value,
            "priority": n.priority.value,
            "title": n.title,
            "body": n.body,
            "link": n.link,
            "read": n.read_at is not None,
            "created_at": n.created_at,
        }
        for n in rows
    ]


async def unread_count(db: AsyncSession, *, user_id: uuid.UUID) -> int:
    return (
        await db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id, Notification.read_at.is_(None)
            )
        )
    ).scalar_one()


async def mark_read(db: AsyncSession, *, user_id: uuid.UUID, notification_id: uuid.UUID) -> None:
    await db.execute(
        update(Notification)
        .where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(UTC))
    )
    await db.commit()


async def mark_all_read(db: AsyncSession, *, user_id: uuid.UUID) -> int:
    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
    await db.commit()
    return int(result.rowcount or 0)  # type: ignore[attr-defined]
