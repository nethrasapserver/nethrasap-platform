"""KYC request/response schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

DocType = Literal["council_cert", "cdsco_20b_21b", "gstin", "hospital_license"]


class UploadSlotRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    doc_type: DocType
    content_type: Literal["application/pdf", "image/jpeg", "image/png"]
    size_bytes: int = Field(gt=0)


class UploadSlotResponse(BaseModel):
    storage_key: str
    upload_url: str
    expires_in: int


class SubmittedDocument(BaseModel):
    doc_type: DocType
    storage_key: str = Field(min_length=8, max_length=512)
    content_type: Literal["application/pdf", "image/jpeg", "image/png"]
    size_bytes: int | None = Field(default=None, gt=0)


class SubmitRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    documents: list[SubmittedDocument] = Field(min_length=1, max_length=6)
    credential_no: str | None = Field(default=None, max_length=100)


class DecisionRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    notes: str | None = Field(default=None, max_length=2000)


class KycDocumentOut(BaseModel):
    id: UUID
    doc_type: DocType
    content_type: str
    size_bytes: int | None = None
    download_url: str | None = None


class ApplicantOut(BaseModel):
    id: UUID
    phone: str
    role: str
    status: str
    name: str | None = None


class VerificationOut(BaseModel):
    id: UUID
    status: Literal["pending", "approved", "rejected"]
    credential_no: str | None = None
    review_notes: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    applicant: ApplicantOut | None = None
    documents: list[KycDocumentOut] = []


class VerificationListOut(BaseModel):
    items: list[VerificationOut]
    total: int
