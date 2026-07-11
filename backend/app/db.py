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

    return cleaned, connect_args


_db_url, _connect_args = _normalise_url(_settings.database_url)


engine = create_async_engine(
    _db_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
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
