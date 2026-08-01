"""Async SQLAlchemy engine + session factory + FastAPI dependency.

Connection string handling
--------------------------
The engine accepts any standard Postgres URL. We do two normalisations so
the same DATABASE_URL works whether the user pasted a plain Neon string or
the SQLAlchemy-flavoured one:

1. `postgresql://`  ->  `postgresql+asyncpg://`
   asyncpg is our driver; SQLAlchemy needs the explicit dialect+driver.

2. `?sslmode=require` (libpq style) -> stripped from the URL, replaced with
   an explicit `ssl=` context passed via `connect_args`. asyncpg doesn't
   understand `sslmode` — it understands `ssl` — but every other tool (psql,
   pgcli, dashboards) hands out URLs with `sslmode=require`, so we accept
   both.

This means a Neon connection string like
    postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require
works as-is in `.env`.
"""
from __future__ import annotations

import ssl
from collections.abc import AsyncIterator
from typing import Annotated
from urllib.parse import urlsplit, urlunsplit

from fastapi import Depends
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .config import get_settings

_settings = get_settings()


def _normalise_url(url: str) -> tuple[str, dict]:
    """Return (clean_url, connect_args) ready for SQLAlchemy.

    - Adds the `+asyncpg` dialect if missing.
    - Strips `sslmode=*` from the query (asyncpg doesn't read it) and instead
      attaches an explicit `ssl=` context for `sslmode=require` (or any
      `*.neon.tech` host).
    """
    # 1. Ensure the asyncpg dialect is present.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]

    parts = urlsplit(url)
    query_pairs = [
        (k, v)
        for k, v in (
            pair.split("=", 1) if "=" in pair else (pair, "")
            for pair in parts.query.split("&")
            if pair
        )
    ]

    sslmode_value: str | None = None
    cleaned_query = []
    for k, v in query_pairs:
        if k == "sslmode":
            sslmode_value = v
        elif k == "channel_binding":
            # libpq-only option (Neon appends it); asyncpg doesn't accept it.
            continue
        else:
            cleaned_query.append((k, v))

    cleaned = urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            "&".join(f"{k}={v}" if v else k for k, v in cleaned_query),
            parts.fragment,
        )
    )

    needs_ssl = sslmode_value in {"require", "verify-ca", "verify-full"} or (
        parts.hostname is not None and parts.hostname.endswith("neon.tech")
    )
    connect_args: dict = {}
    if needs_ssl:
        connect_args["ssl"] = ssl.create_default_context()

    # Neon's pooled endpoints are transaction-mode PgBouncer: server sessions
    # are shared across clients, so asyncpg's prepared-statement and type
    # caches go stale ("cache lookup failed for type ..."). Disable them.
    if parts.hostname is not None and "-pooler" in parts.hostname:
        connect_args["statement_cache_size"] = 0

    return cleaned, connect_args


_db_url, _connect_args = _normalise_url(_settings.database_url)


def _apply_connection_timeouts(connect_args: dict) -> dict:
    """Attach per-connection `statement_timeout` / `lock_timeout` (M10).

    asyncpg applies `server_settings` at connection startup, so every pooled
    connection inherits the caps and a runaway query or lock-wait is force-
    aborted server-side instead of pinning the connection forever. Values are
    milliseconds (Postgres accepts an integer as ms). Setting the corresponding
    config value to 0 omits that guard — an escape hatch if a managed pooler
    ever refuses the startup parameter. This is merged on top of the existing
    connect_args (so the Neon pooler's `statement_cache_size=0` stays intact).
    """
    server_settings: dict[str, str] = dict(connect_args.get("server_settings", {}))
    if _settings.db_statement_timeout_ms > 0:
        server_settings["statement_timeout"] = str(_settings.db_statement_timeout_ms)
    if _settings.db_lock_timeout_ms > 0:
        server_settings["lock_timeout"] = str(_settings.db_lock_timeout_ms)
    if server_settings:
        connect_args = {**connect_args, "server_settings": server_settings}
    return connect_args


_connect_args = _apply_connection_timeouts(_connect_args)


engine = create_async_engine(
    _db_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    # M10: recycle before an idle server/pooler drops the socket, and never let
    # a checkout block forever when the pool is saturated.
    pool_recycle=_settings.db_pool_recycle_seconds,
    pool_timeout=_settings.db_pool_timeout_seconds,
    future=True,
    connect_args=_connect_args,
)

SessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields a database session per request."""
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


DbSession = Annotated[AsyncSession, Depends(get_session)]
