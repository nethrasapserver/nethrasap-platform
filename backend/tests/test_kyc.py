"""KYC verification flow — upload slots, submit, staff queue, approve/reject,
permission enforcement."""
from __future__ import annotations

import pytest

from .conftest import auth, phone_for, signup_token

DOC = {"doc_type": "cdsco_20b_21b", "content_type": "application/pdf", "size_bytes": 12345}


async def _submit_kyc(client, token: str) -> dict:
    slot = await client.post("/api/v1/kyc/uploads", headers=auth(token), json=DOC)
    assert slot.status_code == 200, slot.text
    key = slot.json()["storage_key"]
    assert slot.json()["upload_url"]
    sub = await client.post(
        "/api/v1/kyc/submit",
        headers=auth(token),
        json={
            "documents": [{**{k: v for k, v in DOC.items()}, "storage_key": key}],
            "credential_no": "DL-20B-4471",
        },
    )
    assert sub.status_code == 201, sub.text
    return sub.json()


@pytest.mark.asyncio
async def test_customer_cannot_request_kyc(client):
    token = await signup_token(client, phone_for("kyc-customer"))
    r = await client.post("/api/v1/kyc/uploads", headers=auth(token), json=DOC)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_kyc_submit_and_status(client):
    token = await signup_token(client, phone_for("kyc-retailer-1"), role="retailer")
    body = await _submit_kyc(client, token)
    assert body["status"] == "pending"
    assert len(body["documents"]) == 1

    st = await client.get("/api/v1/kyc/status", headers=auth(token))
    assert st.json()["status"] == "pending"

    # A second submission while one is pending conflicts.
    dup = await client.post(
        "/api/v1/kyc/submit",
        headers=auth(token),
        json={"documents": [{**DOC, "storage_key": body["documents"][0]["id"]}]},
    )
    assert dup.status_code in (400, 409)


@pytest.mark.asyncio
async def test_cannot_attach_foreign_storage_key(client):
    token = await signup_token(client, phone_for("kyc-retailer-2"), role="retailer")
    r = await client.post(
        "/api/v1/kyc/submit",
        headers=auth(token),
        json={"documents": [{**DOC, "storage_key": "kyc/2026/01/01/someone-else/doc.pdf"}]},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_queue_requires_permission(client):
    token = await signup_token(client, phone_for("kyc-nosy-customer"))
    r = await client.get("/api/v1/verifications", headers=auth(token))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_approve_flow_activates_user(client, staff_tokens):
    token = await signup_token(client, phone_for("kyc-retailer-3"), role="retailer")
    me = await client.get("/api/v1/auth/me", headers=auth(token))
    assert me.json()["status"] == "pending_kyc"
    await _submit_kyc(client, token)

    q = await client.get("/api/v1/verifications?status=pending", headers=auth(staff_tokens["sales"]))
    assert q.status_code == 200, q.text
    items = q.json()["items"]
    mine = next(i for i in items if i["applicant"]["phone"] == phone_for("kyc-retailer-3"))

    detail = await client.get(f"/api/v1/verifications/{mine['id']}", headers=auth(staff_tokens["sales"]))
    assert detail.status_code == 200
    assert detail.json()["documents"][0]["download_url"]

    dec = await client.post(
        f"/api/v1/verifications/{mine['id']}/approve",
        headers=auth(staff_tokens["sales"]),
        json={"notes": "licence verified"},
    )
    assert dec.status_code == 200, dec.text
    assert dec.json()["status"] == "approved"

    me = await client.get("/api/v1/auth/me", headers=auth(token))
    assert me.json()["status"] == "active"

    # Deciding twice conflicts.
    again = await client.post(
        f"/api/v1/verifications/{mine['id']}/reject",
        headers=auth(staff_tokens["sales"]),
        json={},
    )
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_reject_flow_keeps_user_pending(client, staff_tokens):
    token = await signup_token(client, phone_for("kyc-clinician-1"), role="clinician")
    body = await _submit_kyc(client, token)

    dec = await client.post(
        f"/api/v1/verifications/{body['id']}/reject",
        headers=auth(staff_tokens["manager"]),
        json={"notes": "document expired"},
    )
    assert dec.status_code == 200
    assert dec.json()["status"] == "rejected"

    me = await client.get("/api/v1/auth/me", headers=auth(token))
    assert me.json()["status"] == "pending_kyc"
    st = await client.get("/api/v1/kyc/status", headers=auth(token))
    assert st.json()["review_notes"] == "document expired"
