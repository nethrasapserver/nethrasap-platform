"""Notification endpoints — a signed-in user's own inbox."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from ...db import DbSession
from ...deps import CurrentUser
from ...services import notifications as svc

router = APIRouter()


@router.get("/notifications")
async def list_notifications(
    db: DbSession,
    user: CurrentUser,
    unread_only: Annotated[bool, Query()] = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    items = await svc.list_for_user(
        db, user_id=user.id, unread_only=unread_only, limit=limit, offset=offset
    )
    return {"items": items, "unread": await svc.unread_count(db, user_id=user.id)}


@router.get("/notifications/unread-count")
async def unread_count(db: DbSession, user: CurrentUser) -> dict:
    return {"unread": await svc.unread_count(db, user_id=user.id)}


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def mark_read(notification_id: UUID, db: DbSession, user: CurrentUser) -> Response:
    await svc.mark_read(db, user_id=user.id, notification_id=notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/notifications/read-all")
async def mark_all_read(db: DbSession, user: CurrentUser) -> dict:
    return {"marked": await svc.mark_all_read(db, user_id=user.id)}
