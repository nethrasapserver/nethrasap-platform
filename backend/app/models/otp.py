"""One-time passcodes for phone verification — signup, login, password reset."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, created_at, uuid_pk


class OtpPurpose(str, enum.Enum):
    signup = "signup"
    login = "login"
    reset = "reset"


class OtpCode(Base):
    """A single issued OTP. Codes are stored hashed, never in plaintext.

    Verification rules (enforced in services/otp.py):
      - expires `otp_ttl_seconds` after creation,
      - at most `otp_max_attempts` failed tries, then burned,
      - consumed exactly once (`consumed_at`),
      - re-requesting within the resend cooldown is rejected.
    """

    __tablename__ = "otp_codes"
    __table_args__ = (
        Index("ix_otp_codes_phone_purpose", "phone", "purpose"),
    )

    id: Mapped[uuid_pk]
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    purpose: Mapped[OtpPurpose] = mapped_column(
        SAEnum(OtpPurpose, name="otp_purpose", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[created_at]
