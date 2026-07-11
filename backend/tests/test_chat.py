"""Chat — customer opens/sends, staff inbox/claim/reply/close, notifications."""
from __future__ import annotations

import pytest

from .conftest import auth, phone_for, signup_token


async def _open(client, token):
    r = await client.post("/api/v1/chat/conversations", headers=auth(token), json={"subject": "Order help"})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.asyncio
async def test_open_is_idempotent(client):
    token = await signup_token(client, phone_for("chat-cust-1"))
    a = await _open(client, token)
    b = await _open(client, token)
    assert a["id"] == b["id"]  # one open conversation reused


@pytest.mark.asyncio
async def test_customer_send_and_staff_reply(client, staff_tokens):
    sales = staff_tokens["sales"]
    token = await signup_token(client, phone_for("chat-cust-2"))
    conv = await _open(client, token)
    cid = conv["id"]

    # Customer sends.
    m = await client.post(
        f"/api/v1/chat/conversations/{cid}/messages", headers=auth(token), json={"body": "Where is my order?"}
    )
    assert m.status_code == 201, m.text

    # Appears in the unassigned inbox.
    inbox = await client.get("/api/v1/admin/chat/inbox?scope=unassigned", headers=auth(sales))
    assert any(c["id"] == cid for c in inbox.json())

    # Rep claims + replies.
    claim = await client.post(f"/api/v1/admin/chat/conversations/{cid}/claim", headers=auth(sales))
    assert claim.status_code == 200
    assert claim.json()["assigned_to"]

    reply = await client.post(
        f"/api/v1/admin/chat/conversations/{cid}/messages",
        headers=auth(sales),
        json={"body": "It ships today."},
    )
    assert reply.status_code == 201

    # Customer got a chat notification + sees both messages.
    notifs = await client.get("/api/v1/notifications", headers=auth(token))
    assert any(n["type"] == "chat" for n in notifs.json()["items"])
    thread = await client.get(f"/api/v1/chat/conversations/{cid}", headers=auth(token))
    bodies = [msg["body"] for msg in thread.json()["messages"]]
    assert bodies == ["Where is my order?", "It ships today."]


@pytest.mark.asyncio
async def test_claim_conflict(client, staff_tokens):
    token = await signup_token(client, phone_for("chat-cust-3"))
    conv = await _open(client, token)
    cid = conv["id"]
    await client.post(f"/api/v1/admin/chat/conversations/{cid}/claim", headers=auth(staff_tokens["sales"]))
    r = await client.post(
        f"/api/v1/admin/chat/conversations/{cid}/claim", headers=auth(staff_tokens["manager"])
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_close_and_reopen(client, staff_tokens):
    sales = staff_tokens["sales"]
    token = await signup_token(client, phone_for("chat-cust-4"))
    conv = await _open(client, token)
    cid = conv["id"]
    await client.post(f"/api/v1/chat/conversations/{cid}/messages", headers=auth(token), json={"body": "hi"})

    closed = await client.post(f"/api/v1/admin/chat/conversations/{cid}/close", headers=auth(sales))
    assert closed.json()["status"] == "closed"

    # Staff can't post to a closed thread.
    r = await client.post(
        f"/api/v1/admin/chat/conversations/{cid}/messages", headers=auth(sales), json={"body": "still there?"}
    )
    assert r.status_code == 409

    # A customer message reopens it.
    r = await client.post(
        f"/api/v1/chat/conversations/{cid}/messages", headers=auth(token), json={"body": "actually one more Q"}
    )
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_inbox_requires_permission(client):
    customer = await signup_token(client, phone_for("chat-nosy"))
    r = await client.get("/api/v1/admin/chat/inbox", headers=auth(customer))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_outsider_cannot_read_conversation(client, staff_tokens):
    owner = await signup_token(client, phone_for("chat-owner"))
    other = await signup_token(client, phone_for("chat-other"))
    conv = await _open(client, owner)
    r = await client.get(f"/api/v1/chat/conversations/{conv['id']}", headers=auth(other))
    assert r.status_code == 403
