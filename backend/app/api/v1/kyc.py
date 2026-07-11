"""KYC endpoints — user side (upload/submit/status) + staff review queue."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from ...db import DbSession
from ...deps import ClientMeta, CurrentUser, Paged, require_permission
from ...models.user import User
from ...schemas.kyc import (
    DecisionRequest,
    SubmitRequest,
    UploadSlotRequest,
    UploadSlotResponse,
    VerificationListOut,
    VerificationOut,
)
from ...services import kyc as svc

router = APIRouter()

ReviewUser = Annotated[User, Depends(require_permission("kyc:review"))]
ApproveUser = Annotated[User, Depends(require_permission("kyc:approve"))]
RejectUser = Annotated[User, Depends(require_permission("kyc:reject"))]


# --- User side ---------------------------------------------------------------


@router.post("/kyc/uploads", response_model=UploadSlotResponse)
async def create_upload_slot(payload: UploadSlotRequest, user: CurrentUser) -> UploadSlotResponse:
    slot = svc.create_upload_slot(
        user,
        doc_type=payload.doc_type,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
    )
    return UploadSlotResponse(**slot)


@router.post("/kyc/submit", response_model=VerificationOut, status_code=status.HTTP_201_CREATED)
async def submit(payload: SubmitRequest, db: DbSession, user: CurrentUser, meta: ClientMeta) -> VerificationOut:
    req = await svc.submit_request(
        db,
        user,
        documents=[d.model_dump() for d in payload.documents],
        credential_no=payload.credential_no,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
    )
    return VerificationOut(**svc.serialise_request(req))


@router.get("/kyc/status", response_model=VerificationOut | None)
async def my_status(db: DbSession, user: CurrentUser) -> VerificationOut | None:
    req = await svc.my_status(db, user)
    return VerificationOut(**svc.serialise_request(req)) if req else None


# --- Staff side --------------------------------------------------------------


@router.get("/verifications", response_model=VerificationListOut)
async def queue(
    db: DbSession,
    _staff: ReviewUser,
    page: Paged,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
) -> VerificationListOut:
    rows, total = await svc.list_queue(
        db, status_filter=status_filter, limit=page.limit, offset=page.offset
    )
    return VerificationListOut(
        items=[VerificationOut(**svc.serialise_request(req, applicant)) for req, applicant in rows],
        total=total,
    )


@router.get("/verifications/{request_id}", response_model=VerificationOut)
async def detail(request_id: UUID, db: DbSession, _staff: ReviewUser) -> VerificationOut:
    req, applicant = await svc.get_request(db, request_id)
    return VerificationOut(**svc.serialise_request(req, applicant, with_urls=True))


@router.post("/verifications/{request_id}/approve", response_model=VerificationOut)
async def approve(
    request_id: UUID, payload: DecisionRequest, db: DbSession, staff: ApproveUser, meta: ClientMeta
) -> VerificationOut:
    req = await svc.decide(
        db,
        request_id=request_id,
        reviewer=staff,
        approve=True,
        notes=payload.notes,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
    )
    return VerificationOut(**svc.serialise_request(req))


@router.post("/verifications/{request_id}/reject", response_model=VerificationOut)
async def reject(
    request_id: UUID, payload: DecisionRequest, db: DbSession, staff: RejectUser, meta: ClientMeta
) -> VerificationOut:
    req = await svc.decide(
        db,
        request_id=request_id,
        reviewer=staff,
        approve=False,
        notes=payload.notes,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
    )
    return VerificationOut(**svc.serialise_request(req))
