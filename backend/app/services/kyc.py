"""KYC verification workflow.

Customer side: presigned upload slots → submit request → wait.
Staff side: queue → review documents (signed GETs) → approve/reject.
Approval flips the user pending_kyc → active, which is what unlocks
clinician/retailer tier pricing in the catalogue.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..integrations import sms, storage
from ..logging import get_logger
from ..models.audit import AuditLog
from ..models.user import User, UserRole, UserStatus
from ..models.verification import (
    KycDocType,
    KycDocument,
    VerificationRequest,
    VerificationStatus,
)
from ..realtime import publish_event
from ..realtime.channels import role_channel, user_channel

log = get_logger("services.kyc")

KYC_ROLES = (UserRole.clinician, UserRole.retailer)


def _require_kyc_role(user: User) -> None:
    if user.role not in KYC_ROLES:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "KYC verification applies to clinician and retailer accounts only",
        )


def create_upload_slot(user: User, *, doc_type: str, content_type: str, size_bytes: int) -> dict:
    """Mint a presigned PUT for one document. Nothing persists until submit."""
    _require_kyc_role(user)
    try:
        KycDocType(doc_type)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid doc_type: {doc_type}") from None
    if content_type not in storage.ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"content_type must be one of {', '.join(storage.ALLOWED_DOCUMENT_TYPES)}",
        )
    if size_bytes > storage.MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "file too large (max 10 MB)")

    key = storage.make_key("kyc", content_type=content_type, prefix=str(user.id))
    return {
        "storage_key": key,
        "upload_url": storage.presigned_put(key, content_type=content_type),
        "expires_in": storage.PRESIGNED_PUT_TTL,
    }


async def submit_request(
    db: AsyncSession,
    user: User,
    *,
    documents: list[dict],
    credential_no: str | None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> VerificationRequest:
    _require_kyc_role(user)

    open_request = (
        await db.execute(
            select(VerificationRequest).where(
                VerificationRequest.user_id == user.id,
                VerificationRequest.status == VerificationStatus.pending,
            )
        )
    ).scalar_one_or_none()
    if open_request is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "a verification request is already pending")

    req = VerificationRequest(user_id=user.id, credential_no=credential_no)
    for d in documents:
        # Only accept keys inside the caller's own kyc namespace — a client
        # cannot attach someone else's uploaded document.
        if not d["storage_key"].startswith("kyc/") or f"/{user.id}/" not in d["storage_key"]:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "storage_key not owned by caller")
        req.documents.append(
            KycDocument(
                doc_type=KycDocType(d["doc_type"]),
                storage_key=d["storage_key"],
                content_type=d["content_type"],
                size_bytes=d.get("size_bytes"),
            )
        )
    db.add(req)
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="kyc.submitted",
            entity_type="verification_request",
            entity_id="pending-flush",
            payload={"documents": len(documents)},
            ip=ip,
            user_agent=user_agent,
        )
    )
    await db.flush()
    await db.commit()

    await publish_event(
        role_channel("sales"),
        type="verification.submitted",
        entity="verification_request",
        entity_id=str(req.id),
        payload={"user_id": str(user.id), "role": user.role.value},
    )
    log.info("kyc.submitted", request_id=str(req.id), user_id=str(user.id))
    return req


async def my_status(db: AsyncSession, user: User) -> VerificationRequest | None:
    return (
        await db.execute(
            select(VerificationRequest)
            .where(VerificationRequest.user_id == user.id)
            .order_by(VerificationRequest.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def list_queue(
    db: AsyncSession, *, status_filter: str | None, limit: int, offset: int
) -> tuple[list[tuple[VerificationRequest, User]], int]:
    base = select(VerificationRequest).join(User, User.id == VerificationRequest.user_id)
    if status_filter:
        try:
            base = base.where(VerificationRequest.status == VerificationStatus(status_filter))
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid status: {status_filter}") from None
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        (
            await db.execute(
                base.add_columns(User)
                .order_by(VerificationRequest.created_at.asc())
                .limit(limit)
                .offset(offset)
            )
        )
        .all()
    )
    return [(r[0], r[1]) for r in rows], total


async def get_request(db: AsyncSession, request_id: uuid.UUID) -> tuple[VerificationRequest, User]:
    row = (
        await db.execute(
            select(VerificationRequest, User)
            .join(User, User.id == VerificationRequest.user_id)
            .where(VerificationRequest.id == request_id)
        )
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "verification request not found")
    return row[0], row[1]


async def decide(
    db: AsyncSession,
    *,
    request_id: uuid.UUID,
    reviewer: User,
    approve: bool,
    notes: str | None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> VerificationRequest:
    req, applicant = await get_request(db, request_id)
    if req.status != VerificationStatus.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, f"request already {req.status.value}")

    req.status = VerificationStatus.approved if approve else VerificationStatus.rejected
    req.reviewed_by = reviewer.id
    req.reviewed_at = datetime.now(UTC)
    req.review_notes = notes

    if approve:
        applicant.status = UserStatus.active

    db.add(
        AuditLog(
            actor_user_id=reviewer.id,
            action="kyc.approved" if approve else "kyc.rejected",
            entity_type="verification_request",
            entity_id=str(req.id),
            payload={"applicant": str(applicant.id), "notes": notes},
            ip=ip,
            user_agent=user_agent,
        )
    )
    await db.commit()

    await publish_event(
        [user_channel(str(applicant.id)), role_channel("sales")],
        type="verification.decided",
        entity="verification_request",
        entity_id=str(req.id),
        payload={"approved": approve},
    )
    if approve:
        sms.send_sms(
            to=applicant.phone,
            body="Nethrasap: your KYC is approved. Wholesale/institutional pricing is now active on your account.",
        )
    else:
        sms.send_sms(
            to=applicant.phone,
            body="Nethrasap: your KYC could not be approved. Open the app to review the notes and resubmit.",
        )
    log.info(
        "kyc.decided",
        request_id=str(req.id),
        approved=approve,
        reviewer=str(reviewer.id),
    )
    return req


def serialise_request(
    req: VerificationRequest, applicant: User | None = None, *, with_urls: bool = False
) -> dict[str, Any]:
    return {
        "id": req.id,
        "status": req.status.value,
        "credential_no": req.credential_no,
        "review_notes": req.review_notes,
        "reviewed_at": req.reviewed_at,
        "created_at": req.created_at,
        "applicant": (
            {
                "id": applicant.id,
                "phone": applicant.phone,
                "role": applicant.role.value,
                "status": applicant.status.value,
                "name": applicant.profile.full_name if applicant.profile else None,
            }
            if applicant
            else None
        ),
        "documents": [
            {
                "id": d.id,
                "doc_type": d.doc_type.value,
                "content_type": d.content_type,
                "size_bytes": d.size_bytes,
                **({"download_url": storage.presigned_get(d.storage_key)} if with_urls else {}),
            }
            for d in req.documents
        ],
    }
