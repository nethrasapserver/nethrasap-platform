"""Auth request/response schemas — phone-first, no email anywhere."""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..phone import InvalidPhoneError, normalize_phone


class _PhoneMixin(BaseModel):
    """Normalizes any accepted Indian/E.164 phone input to canonical E.164."""

    phone: str = Field(min_length=8, max_length=20)

    @field_validator("phone")
    @classmethod
    def _normalize(cls, v: str) -> str:
        try:
            return normalize_phone(v)
        except InvalidPhoneError as e:
            raise ValueError(str(e)) from None


class OtpRequestRequest(_PhoneMixin):
    model_config = ConfigDict(str_strip_whitespace=True)

    purpose: Literal["signup", "login", "reset"]


class OtpVerifyRequest(_PhoneMixin):
    model_config = ConfigDict(str_strip_whitespace=True)

    purpose: Literal["signup", "login", "reset"]
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class OtpVerifyResponse(BaseModel):
    """For signup/reset purposes: a short-lived proof token to present next."""

    otp_token: str
    expires_in: int  # seconds


class SignupRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    role: Literal["customer", "clinician", "retailer"]  # portal roles are provisioned, not self-signup
    otp_token: str = Field(min_length=10, description="signup-purpose proof from /auth/otp/verify")
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)


class LoginRequest(_PhoneMixin):
    model_config = ConfigDict(str_strip_whitespace=True)

    password: str = Field(min_length=1, max_length=128)


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    otp_token: str = Field(min_length=10, description="reset-purpose proof from /auth/otp/verify")
    new_password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    """Refresh/logout body. The token normally rides in the httpOnly
    `nethra_rt` cookie now; the body field remains for pre-cookie clients."""

    refresh_token: str | None = Field(default=None, min_length=10, max_length=200)


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
    phone: str
    role: Literal["customer", "clinician", "retailer", "sales", "manager", "admin"]
    status: Literal["pending_kyc", "active", "suspended"]
    phone_verified: bool
    last_login_at: datetime | None = None
    profile: UserProfileResponse | None = None
    permissions: list[str] = []
