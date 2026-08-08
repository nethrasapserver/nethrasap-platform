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

    # --- Build / release identity (surfaced on /health) ---
    # `app_version` tracks the package version; `git_sha` is injected by CI at
    # build/deploy time (blank in local dev). Both are informational only.
    app_version: str = "0.1.0"
    git_sha: str = ""

    database_url: str
    test_database_url: str | None = None
    redis_url: str = "redis://localhost:6379/0"

    # --- DB pool hardening (M10) ---------------------------------------------
    # Recycle connections before Neon/pgbouncer or a network idle-timeout can
    # kill them from under us; cap how long a checkout waits for a free slot;
    # and cap how long any single statement / lock-wait can run so a runaway
    # query can never pin a pooled connection indefinitely. Set a *_ms value to
    # 0 to disable that server-side timeout (e.g. if a pooler rejects it).
    db_pool_recycle_seconds: int = Field(default=1800, ge=0)
    db_pool_timeout_seconds: int = Field(default=30, ge=1)
    db_statement_timeout_ms: int = Field(default=30_000, ge=0)
    db_lock_timeout_ms: int = Field(default=10_000, ge=0)

    # --- Observability (M2) — dormant until provisioned ----------------------
    # Sentry stays completely inert until a DSN is supplied: no SDK import, no
    # init, no network. Prometheus /metrics is a cheap in-process counter with
    # no external dependency; flip metrics_enabled off to drop the route.
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    sentry_environment: str = ""
    metrics_enabled: bool = True

    jwt_secret: str
    jwt_alg: str = "HS256"
    access_token_ttl_min: int = Field(default=15, ge=1, le=120)
    refresh_token_ttl_days: int = Field(default=30, ge=1, le=365)

    # Stored as a comma-separated string in env so pydantic-settings v2.6
    # doesn't try to JSON-decode it. Use `cors_origins_list` to get the list.
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # --- SMS / OTP (phone-first platform; there is deliberately no email) ---
    # Kill-switch for the whole OTP surface while DLT/SMS registration is
    # pending: when False, /auth/otp/* return 503, signup accepts a raw
    # (unverified) phone + password, and the console-provider production
    # guard is skipped since no OTPs are ever generated.
    otp_enabled: bool = True
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
    # Browser-reachable S3 endpoint used ONLY to sign presigned PUT/GET URLs.
    # Server-side ops (put_bytes/delete) always use storage_endpoint. These
    # differ only when the backend reaches storage over a private network the
    # browser can't (local MinIO: server=http://minio:9000, browser=http://
    # localhost:9000). Left blank, presign uses storage_endpoint (R2 prod, where
    # one internet host serves both).
    storage_public_endpoint: str = ""

    # --- Tax invoice (seller identity) ---
    # Seller GSTIN printed on GST tax invoices. Env-driven so it can be set per
    # deployment without a DB write; the ops-editable app_settings `seller_gstin`
    # key (if present) still overrides this. Left blank the invoice omits the
    # GSTIN line and the invoice is not a compliant Indian tax invoice — set it
    # in production.
    seller_gstin: str = ""

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
        if self.environment == "production":
            if self.sms_provider == "console" and self.otp_enabled:
                raise ValueError(
                    "SMS_PROVIDER=console only logs messages (and would leak OTPs into "
                    "production logs) — refusing to start with ENVIRONMENT=production. "
                    "Configure a real provider (msg91/exotel/twilio), or set "
                    "OTP_ENABLED=false to run password-only until DLT approval."
                )
            if not (
                self.storage_endpoint
                and self.storage_access_key_id
                and self.storage_secret_access_key
            ):
                raise ValueError(
                    "Object storage is unconfigured (STORAGE_ENDPOINT / "
                    "STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY) — the stub "
                    "silently discards uploads, so refusing to start with "
                    "ENVIRONMENT=production."
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
