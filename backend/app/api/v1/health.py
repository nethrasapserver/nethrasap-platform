"""Liveness + readiness."""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from ...db import DbSession

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "nethrasap-api"}


@router.get("/ready")
async def ready(db: DbSession) -> dict:
    """DB-backed readiness check."""
    await db.execute(text("SELECT 1"))
    return {"status": "ready"}
