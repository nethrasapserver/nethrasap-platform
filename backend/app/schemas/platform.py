"""Response/request schemas for the super-admin Platform Ops console.

These are the stable contract the ops dashboard codes against — keep field
names/shapes stable across changes.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


# --- GET /platform/status ----------------------------------------------------


class ServiceStatus(BaseModel):
    """Per-dependency health flags ("ok" / "error"; worker adds "stale"/"down")."""

    database: str
    redis: str
    worker: str


class QueueCounts(BaseModel):
    """job_outbox depth by status."""

    pending: int
    failed: int
    dispatched: int


class WorkerHeartbeat(BaseModel):
    last_heartbeat: str | None = None
    stale: bool


class PlatformStatus(BaseModel):
    services: ServiceStatus
    queue: QueueCounts
    worker: WorkerHeartbeat
    version: str
    git_sha: str | None = None


# --- GET /platform/audit -----------------------------------------------------


class AuditItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    actor_user_id: uuid.UUID | None = None
    actor_phone: str | None = None
    payload: dict
    created_at: datetime


# --- feature flags -----------------------------------------------------------


class FeatureFlagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    enabled: bool
    description: str | None = None


class FlagUpdate(BaseModel):
    enabled: bool


# --- GET /platform/integrations ---------------------------------------------


class IntegrationOut(BaseModel):
    """Non-secret wiring status for one external integration."""

    name: str
    configured: bool
    detail: str | None = None
