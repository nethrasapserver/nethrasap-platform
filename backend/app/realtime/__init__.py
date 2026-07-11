"""Realtime layer: WebSocket hub + Redis pub/sub fan-out.

Write path: services call `events.publish_event()` after commit → the event
lands on Redis pub/sub → every API process's hub forwards it to the local
WebSocket connections subscribed to that channel.

Events carry ids, not full objects — clients refetch on receipt/reconnect, so
a missed event can only mean a stale cache, never wrong data.
"""
from .events import publish_event

__all__ = ["publish_event"]
