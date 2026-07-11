"""Chat endpoints — customer widget + staff inbox (chat:manage)."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...db import DbSession
from ...deps import CurrentUser, require_permission
from ...models.user import User
from ...redis import rate_limit
from ...schemas.chat import (
    ConversationOut,
    MessageOut,
    OpenConversation,
    SendMessage,
)
from ...services import chat as svc

router = APIRouter()

ChatStaff = Annotated[User, Depends(require_permission("chat:manage"))]


# --- Customer ----------------------------------------------------------------


@router.post("/chat/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def open_conversation(payload: OpenConversation, db: DbSession, user: CurrentUser) -> ConversationOut:
    conv = await svc.open_conversation(db, user, subject=payload.subject)
    return ConversationOut(**svc._serialise(conv))


@router.get("/chat/conversations/{conversation_id}", response_model=ConversationOut)
async def get_conversation(conversation_id: UUID, db: DbSession, user: CurrentUser) -> ConversationOut:
    return ConversationOut(**await svc.messages(db, user, conversation_id=conversation_id))


@router.post("/chat/conversations/{conversation_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: UUID, payload: SendMessage, db: DbSession, user: CurrentUser
) -> MessageOut:
    if not await rate_limit(f"chat:{user.id}", limit=30, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "slow down")
    msg = await svc.send_message(db, user, conversation_id=conversation_id, body=payload.body)
    return MessageOut(**msg)


# --- Staff -------------------------------------------------------------------


@router.get("/admin/chat/inbox", response_model=list[ConversationOut])
async def inbox(
    db: DbSession,
    staff: ChatStaff,
    scope: Annotated[str, Query(pattern="^(unassigned|mine|all)$")] = "unassigned",
) -> list[ConversationOut]:
    return [ConversationOut(**c) for c in await svc.inbox(db, staff, scope=scope)]


@router.post("/admin/chat/conversations/{conversation_id}/claim", response_model=ConversationOut)
async def claim(conversation_id: UUID, db: DbSession, staff: ChatStaff) -> ConversationOut:
    return ConversationOut(**await svc.claim(db, staff, conversation_id=conversation_id))


@router.post("/admin/chat/conversations/{conversation_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def staff_reply(
    conversation_id: UUID, payload: SendMessage, db: DbSession, staff: ChatStaff
) -> MessageOut:
    msg = await svc.send_message(db, staff, conversation_id=conversation_id, body=payload.body)
    return MessageOut(**msg)


@router.post("/admin/chat/conversations/{conversation_id}/close", response_model=ConversationOut)
async def close(conversation_id: UUID, db: DbSession, staff: ChatStaff) -> ConversationOut:
    return ConversationOut(**await svc.close(db, staff, conversation_id=conversation_id))
