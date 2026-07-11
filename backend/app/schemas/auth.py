"""Auth request/response schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    role: Literal["customer", "clinician", "retailer"]  # portal roles are seeded, not self-signup
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=32)


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=200)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int  # access token TTL in seconds


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str
    avatar_url: str | None = None
    attributes: dict = {}


class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    phone: str | None = None
    role: Literal["customer", "clinician", "retailer", "sales", "manager", "admin"]
    status: Literal["pending_kyc", "active", "suspended"]
    email_verified: bool
    last_login_at: datetime | None = None
    profile: UserProfileResponse | None = None
    permissions: list[str] = []
