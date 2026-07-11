"""KYC verification — how clinicians and retailers unlock tier pricing."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_at, updated_at, uuid_pk


class VerificationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class KycDocType(str, enum.Enum):
    council_cert = "council_cert"          # clinician: medical council registration
    cdsco_20b_21b = "cdsco_20b_21b"        # retailer: drug licence forms 20B/21B
    gstin = "gstin"
    hospital_license = "hospital_license"


class VerificationRequest(Base):
    __tablename__ = "verification_requests"

    id: Mapped[uuid_pk]
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[VerificationStatus] = mapped_column(
        SAEnum(
            VerificationStatus,
            name="verification_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=VerificationStatus.pending,
        server_default=VerificationStatus.pending.value,
        index=True,
    )
    credential_no: Mapped[str | None] = mapped_column(String(100))

    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    documents: Mapped[list[KycDocument]] = relationship(
        back_populates="request", cascade="all, delete-orphan", lazy="selectin"
    )


class KycDocument(Base):
    __tablename__ = "kyc_documents"

    id: Mapped[uuid_pk]
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("verification_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    doc_type: Mapped[KycDocType] = mapped_column(
        SAEnum(KycDocType, name="kyc_doc_type", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)

    created_at: Mapped[created_at]

    request: Mapped[VerificationRequest] = relationship(back_populates="documents")
