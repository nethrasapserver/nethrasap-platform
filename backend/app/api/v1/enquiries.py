"""Enquiry (RFQ) endpoints — customer-facing + staff (enquiries:manage)."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from ...db import DbSession
from ...deps import CurrentUser, require_permission
from ...models.user import User
from ...schemas.enquiry import (
    AssignInput,
    EnquiryCreate,
    EnquiryOut,
    MessageInput,
    QuoteInput,
    RejectInput,
)
from ...services import enquiries as svc

router = APIRouter()

EnquiryStaff = Annotated[User, Depends(require_permission("enquiries:manage"))]


# --- Customer ----------------------------------------------------------------


@router.post("/enquiries", response_model=EnquiryOut, status_code=status.HTTP_201_CREATED)
async def create_enquiry(payload: EnquiryCreate, db: DbSession, user: CurrentUser) -> EnquiryOut:
    enq = await svc.create_enquiry(
        db, user, items=[i.model_dump() for i in payload.items], note=payload.note
    )
    return EnquiryOut(**svc._serialise(enq, full=True))


@router.get("/enquiries", response_model=list[EnquiryOut])
async def my_enquiries(db: DbSession, user: CurrentUser) -> list[EnquiryOut]:
    return [EnquiryOut(**e) for e in await svc.list_for_customer(db, customer_id=user.id)]


@router.get("/enquiries/{enquiry_id}", response_model=EnquiryOut)
async def get_enquiry(enquiry_id: UUID, db: DbSession, user: CurrentUser) -> EnquiryOut:
    return EnquiryOut(**await svc.detail(db, enquiry_id=enquiry_id, user=user))


@router.post("/enquiries/{enquiry_id}/messages", response_model=EnquiryOut)
async def post_message(enquiry_id: UUID, payload: MessageInput, db: DbSession, user: CurrentUser) -> EnquiryOut:
    enq = await svc.post_message(db, user, enquiry_id=enquiry_id, body=payload.body)
    return EnquiryOut(**svc._serialise(enq, full=True))


@router.post("/enquiries/{enquiry_id}/accept", response_model=EnquiryOut)
async def accept_quote(enquiry_id: UUID, db: DbSession, user: CurrentUser) -> EnquiryOut:
    enq = await svc.accept_quote(db, user, enquiry_id=enquiry_id)
    return EnquiryOut(**svc._serialise(enq, full=True))


# --- Staff -------------------------------------------------------------------


@router.get("/admin/enquiries", response_model=list[EnquiryOut])
async def enquiry_queue(
    db: DbSession,
    actor: EnquiryStaff,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    mine: Annotated[bool, Query()] = False,
) -> list[EnquiryOut]:
    rows = await svc.list_queue(db, status_filter=status_filter, mine=actor.id if mine else None)
    return [EnquiryOut(**e) for e in rows]


@router.post("/admin/enquiries/{enquiry_id}/assign", response_model=EnquiryOut)
async def assign(enquiry_id: UUID, payload: AssignInput, db: DbSession, actor: EnquiryStaff) -> EnquiryOut:
    enq = await svc.assign(db, actor, enquiry_id=enquiry_id, rep_id=payload.rep_id)
    return EnquiryOut(**svc._serialise(enq, full=True))


@router.post("/admin/enquiries/{enquiry_id}/quote", response_model=EnquiryOut)
async def quote(enquiry_id: UUID, payload: QuoteInput, db: DbSession, actor: EnquiryStaff) -> EnquiryOut:
    enq = await svc.quote(
        db, actor, enquiry_id=enquiry_id, lines=[ln.model_dump() for ln in payload.lines],
        valid_days=payload.valid_days,
    )
    return EnquiryOut(**svc._serialise(enq, full=True))


@router.post("/admin/enquiries/{enquiry_id}/reject", response_model=EnquiryOut)
async def reject(enquiry_id: UUID, payload: RejectInput, db: DbSession, actor: EnquiryStaff) -> EnquiryOut:
    enq = await svc.reject(db, actor, enquiry_id=enquiry_id, reason=payload.reason)
    return EnquiryOut(**svc._serialise(enq, full=True))


@router.post("/admin/enquiries/{enquiry_id}/convert")
async def convert(enquiry_id: UUID, db: DbSession, actor: EnquiryStaff) -> dict:
    return await svc.convert_to_order(db, actor, enquiry_id=enquiry_id)
