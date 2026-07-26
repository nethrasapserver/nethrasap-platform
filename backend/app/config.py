"""Application configuration — loaded from environment via pydantic-settings."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed configuration.

    All values come from environment variables (or the `.env` file at the
    repository root when developing locally). See `.env.example` for the
    full list and defaults.
    """

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    environment: Literal["dev", "test", "staging", "production"] = "dev"
    log_level: str = "INFO"

    database_url: str
    test_database_url: str | None = None
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str
    jwt_alg: str = "HS256"
    access_token_ttl_min: int = Field(default=15, ge=1, le=120)
    refresh_token_ttl_days: int = Field(default=30, ge=1, le=365)

    # Stored as a comma-separated string in env so pydantic-settings v2.6
    # doesn't try to JSON-decode it. Use `cors_origins_list` to get the list.
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # --- SMS / OTP (phone-first platform; there is deliberately no email) ---
    sms_provider: Literal["console", "msg91", "exotel", "twilio"] = "console"
    sms_api_key: str = ""
    sms_sender_id: str = "NTHRSP"
    otp_ttl_seconds: int = Field(default=300, ge=60, le=900)
    otp_max_attempts: int = Field(default=5, ge=1, le=10)
    otp_resend_cooldown_seconds: int = Field(default=45, ge=10, le=300)

    # --- Object storage (Cloudflare R2, S3-compatible) ---
    storage_endpoint: str = ""
    storage_bucket: str = "nethrasap"
    storage_access_key_id: str = ""
    storage_secret_access_key: str = ""
    storage_public_base_url: str = ""

    # --- Payments ---
    # Comma-separated list of checkout methods offered to customers. COD-only
    # for launch; add upi/card/netbanking/wallet here once the Razorpay modal
    # ships on the storefront — no code changes needed to re-enable them.
    payment_methods_enabled: str = "cod"

    # Razorpay credentials (used by the gateway methods when enabled).
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # --- Pincode lookup (checkout address autofill) ---
    # "india_post" resolves unknown PINs via the public postal API and caches
    # them; "none" disables the network call (cache-only — useful in tests/air-
    # gapped). Swap the URL for a licensed dataset service in production.
    pincode_provider: Literal["india_post", "none"] = "india_post"
    pincode_api_url: str = "https://api.postalpincode.in/pincode"

    @model_validator(mode="after")
    def enforce_production_safety(self) -> Self:
        """Refuse to boot with dev-grade secrets outside dev/test.

        This is the backstop that keeps a copy-pasted `.env.example` from ever
        serving traffic in staging/production.
        """
        if self.jwt_secret.startswith("REPLACE_ME") or len(self.jwt_secret) < 32:
            if self.is_dev:
                # Tolerated during local bring-up; logging.py emits a warning.
                return self
            raise ValueError(
                "JWT_SECRET is a placeholder or under 32 chars — refusing to start "
                f"with ENVIRONMENT={self.environment}. Generate one with: "
                "python3 -c 'import secrets; print(secrets.token_urlsafe(64))'"
            )
        return self

    @property
    def is_dev(self) -> bool:
        return self.environment in ("dev", "test")

    @property
    def cookie_secure(self) -> bool:
        """HTTP-only cookies are Secure everywhere except local dev/test."""
        return not self.is_dev

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def payment_methods_enabled_list(self) -> list[str]:
        return [m.strip().lower() for m in self.payment_methods_enabled.split(",") if m.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
