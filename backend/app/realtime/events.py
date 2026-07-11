"""publish_event() — the single choke point every domain event flows through.

Services call this *after* their transaction commits. The envelope is small on
purpose (ids only): clients refetch what changed, so delivery is best-effort
and an event can never carry stale object state.
"""
from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from ..config import get_settings
from ..logging import get_logger
from ..redis import get_redis

log = get_logger("realtime.events")

REDIS_CHANNEL_PREFIX = "rt:"


async def publish_event(
    channels: str | list[str],
    *,
    type: str,
    entity: str,
    entity_id: str,
    payload: dict[str, Any] | None = None,
) -> None:
    """Publish one event to one or more channels.

    Never raises in dev (realtime is optional before `docker compose up`);
    in production a publish failure is logged loudly but still doesn't abort
    the request — the write already committed and clients refetch on reconnect.
    """
    if isinstance(channels, str):
        channels = [channels]
    envelope = json.dumps(
        {
            "type": type,
            "entity": entity,
            "entity_id": entity_id,
            "ts": datetime.now(UTC).isoformat(),
            "payload": payload or {},
        }
    )
    try:
        r = get_redis()
        for channel in channels:
            await r.publish(f"{REDIS_CHANNEL_PREFIX}{channel}", envelope)
    except Exception:
        if get_settings().is_dev:
            log.warning("publish_event.redis_unavailable", type=type, channels=channels)
        else:
            log.exception("publish_event.failed", type=type, channels=channels)
