"""Application configuration — loaded from environment via pydantic-settings."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
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

    environment: Literal["dev", "test", "staging", "prod"] = "dev"
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
    cors_origins: str = "http://localhost:5173"

    @field_validator("jwt_secret")
    @classmethod
    def reject_placeholder_secret(cls, v: str) -> str:
        if v.startswith("REPLACE_ME"):
            # Allow during dev to make first-boot diagnostics easier — we emit a
            # warning at startup in logging.py instead of crashing.
            return v
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 chars long")
        return v

    @property
    def is_dev(self) -> bool:
        return self.environment in ("dev", "test")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
