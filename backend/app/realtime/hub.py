"""WebSocket connection hub.

One hub per API process. A single Redis pattern subscription (`rt:*`) feeds
all local sockets — so an event published from any process (API or worker)
reaches every connected client, wherever it lives.
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import secrets
from collections import defaultdict

from fastapi import WebSocket

from ..config import get_settings
from ..logging import get_logger
from ..redis import get_redis
from .events import REDIS_CHANNEL_PREFIX

log = get_logger("realtime.hub")

WS_TICKET_TTL_SECONDS = 30
_TICKET_PREFIX = "wsticket:"


class Hub:
    def __init__(self) -> None:
        self._sockets_by_channel: dict[str, set[WebSocket]] = defaultdict(set)
        self._channels_by_socket: dict[WebSocket, set[str]] = {}
        self._listener_task: asyncio.Task | None = None

    # --- connection lifecycle ------------------------------------------------

    def attach(self, ws: WebSocket, channels: set[str]) -> None:
        self._channels_by_socket[ws] = channels
        for ch in channels:
            self._sockets_by_channel[ch].add(ws)
        log.info("ws.attached", channels=sorted(channels))

    def detach(self, ws: WebSocket) -> None:
        for ch in self._channels_by_socket.pop(ws, set()):
            self._sockets_by_channel[ch].discard(ws)
            if not self._sockets_by_channel[ch]:
                del self._sockets_by_channel[ch]

    # --- Redis listener --------------------------------------------------------

    async def start(self) -> None:
        if self._listener_task is None:
            self._listener_task = asyncio.create_task(self._listen(), name="realtime-hub")

    async def stop(self) -> None:
        if self._listener_task is not None:
            self._listener_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._listener_task
            self._listener_task = None

    async def _listen(self) -> None:
        while True:
            try:
                pubsub = get_redis().pubsub()
                await pubsub.psubscribe(f"{REDIS_CHANNEL_PREFIX}*")
                log.info("hub.listening")
                async for message in pubsub.listen():
                    if message["type"] != "pmessage":
                        continue
                    channel = str(message["channel"])[len(REDIS_CHANNEL_PREFIX):]
                    await self._deliver(channel, str(message["data"]))
            except asyncio.CancelledError:
                raise
            except Exception:
                if get_settings().is_dev:
                    log.warning("hub.redis_unavailable_retrying")
                else:
                    log.exception("hub.listener_error_retrying")
                await asyncio.sleep(3)

    async def _deliver(self, channel: str, data: str) -> None:
        dead: list[WebSocket] = []
        for ws in self._sockets_by_channel.get(channel, set()).copy():
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.detach(ws)


hub = Hub()


# --- One-time connect tickets --------------------------------------------------
# WebSocket auth: the client trades its bearer token for a 30s single-use
# ticket over normal HTTPS, then connects with `?ticket=` — access tokens
# never appear in URLs (which get logged by proxies).


async def issue_ws_ticket(claims: dict) -> str:
    ticket = secrets.token_urlsafe(32)
    await get_redis().set(
        f"{_TICKET_PREFIX}{ticket}", json.dumps(claims), ex=WS_TICKET_TTL_SECONDS
    )
    return ticket


async def consume_ws_ticket(ticket: str) -> dict | None:
    raw = await get_redis().getdel(f"{_TICKET_PREFIX}{ticket}")
    return json.loads(raw) if raw else None
