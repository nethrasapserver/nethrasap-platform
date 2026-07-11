"""Realtime endpoints: ticket issuance + the WebSocket itself."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, WebSocket, WebSocketDisconnect, status

from ...deps import _token_claims
from ...logging import get_logger
from ...realtime.channels import authorized_channels
from ...realtime.hub import WS_TICKET_TTL_SECONDS, consume_ws_ticket, hub, issue_ws_ticket

log = get_logger("api.realtime")

router = APIRouter()


@router.post("/realtime/ticket")
async def realtime_ticket(
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    """Trade a valid bearer token for a 30s single-use WebSocket ticket."""
    claims = await _token_claims(authorization)
    ticket = await issue_ws_ticket(
        {"sub": str(claims["sub"]), "role": claims.get("role"), "perm": claims.get("perm", [])}
    )
    return {"ticket": ticket, "expires_in": WS_TICKET_TTL_SECONDS}


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, ticket: str | None = None) -> None:
    if not ticket:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        claims = await consume_ws_ticket(ticket)
    except Exception:
        claims = None
    if claims is None:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.accept()
    channels = authorized_channels(claims)
    hub.attach(ws, channels)
    await ws.send_json({"type": "hello", "channels": sorted(channels)})
    try:
        while True:
            # Inbound traffic is ping/keepalive only — all writes go over REST.
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        hub.detach(ws)
