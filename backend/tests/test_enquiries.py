"""Enquiry (RFQ) lifecycle — create, quote, accept, convert; queue + permissions."""
from __future__ import annotations

import pytest

from .conftest import auth, phone_for, signup_token


async def _create(client, token, variant_id, qty=10, note="bulk order please"):
    r = await client.post(
        "/api/v1/enquiries",
        headers=auth(token),
        json={"items": [{"variant_id": str(variant_id), "quantity": qty}], "note": note},
    )
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.asyncio
async def test_create_and_list(client, seeded_catalogue):
    token = await signup_token(client, phone_for("enq-cust-1"), role="retailer")
    enq = await _create(client, token, seeded_catalogue["variant"].id)
    assert enq["reference"].startswith("ENQ-")
    assert enq["status"] == "pending"
    assert enq["items"][0]["quantity"] == 10

    mine = await client.get("/api/v1/enquiries", headers=auth(token))
    assert mine.status_code == 200
    assert len(mine.json()) == 1


@pytest.mark.asyncio
async def test_queue_requires_permission(client, seeded_catalogue):
    customer = await signup_token(client, phone_for("enq-nosy"))
    r = await client.get("/api/v1/admin/enquiries", headers=auth(customer))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_full_lifecycle_quote_accept_convert(client, seeded_catalogue, staff_tokens):
    sales = staff_tokens["sales"]
    token = await signup_token(client, phone_for("enq-cust-2"), role="retailer")
    enq = await _create(client, token, seeded_catalogue["variant"].id, qty=50)
    eid = enq["id"]
    item_id = enq["items"][0]["id"]

    # Rep sees it in the pending queue.
    q = await client.get("/api/v1/admin/enquiries?status=pending", headers=auth(sales))
    assert any(e["id"] == eid for e in q.json())

    # Rep quotes each line — parks for manager approval, customer sees nothing yet.
    quote = await client.post(
        f"/api/v1/admin/enquiries/{eid}/quote",
        headers=auth(sales),
        json={"lines": [{"item_id": item_id, "unit_price": 90}], "valid_days": 5},
    )
    assert quote.status_code == 200, quote.text
    assert quote.json()["status"] == "pending"
    assert quote.json()["approval_status"] == "pending"
    assert quote.json()["quoted_total"] == 90 * 50

    # Manager approves → released to the customer as a quote.
    appr = await client.post(f"/api/v1/admin/enquiries/{eid}/approve", headers=auth(staff_tokens["manager"]))
    assert appr.status_code == 200, appr.text
    assert appr.json()["status"] == "quoted"
    assert appr.json()["approval_status"] == "approved"

    # Customer accepts.
    acc = await client.post(f"/api/v1/enquiries/{eid}/accept", headers=auth(token))
    assert acc.status_code == 200
    assert acc.json()["status"] == "confirmed"

    # Rep converts to an order.
    conv = await client.post(f"/api/v1/admin/enquiries/{eid}/convert", headers=auth(sales))
    assert conv.status_code == 200, conv.text
    order_number = conv.json()["order_number"]
    assert order_number.startswith("NS-")

    # Enquiry now converted; order exists and belongs to the customer.
    detail = await client.get(f"/api/v1/enquiries/{eid}", headers=auth(token))
    assert detail.json()["status"] == "converted"
    order = await client.get(f"/api/v1/orders/{order_number}", headers=auth(token))
    assert order.status_code == 200
    assert order.json()["items"][0]["unit_price"] == 90


@pytest.mark.asyncio
async def test_cannot_accept_before_quote(client, seeded_catalogue):
    token = await signup_token(client, phone_for("enq-cust-3"), role="retailer")
    enq = await _create(client, token, seeded_catalogue["variant"].id)
    r = await client.post(f"/api/v1/enquiries/{enq['id']}/accept", headers=auth(token))
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_messages_notify_customer(client, seeded_catalogue, staff_tokens):
    sales = staff_tokens["sales"]
    token = await signup_token(client, phone_for("enq-cust-4"), role="retailer")
    enq = await _create(client, token, seeded_catalogue["variant"].id)

    # Rep posts a message → customer gets a notification.
    r = await client.post(
        f"/api/v1/enquiries/{enq['id']}/messages",
        headers=auth(sales),
        json={"body": "Can you confirm the delivery pincode?"},
    )
    assert r.status_code == 200
    assert r.json()["messages"][-1]["body"].startswith("Can you confirm")

    notifs = await client.get("/api/v1/notifications", headers=auth(token))
    assert notifs.json()["unread"] >= 1
    assert any(n["type"] == "enquiry" for n in notifs.json()["items"])


@pytest.mark.asyncio
async def test_reject_closes_enquiry(client, seeded_catalogue, staff_tokens):
    sales = staff_tokens["sales"]
    token = await signup_token(client, phone_for("enq-cust-5"), role="retailer")
    enq = await _create(client, token, seeded_catalogue["variant"].id)
    r = await client.post(
        f"/api/v1/admin/enquiries/{enq['id']}/reject",
        headers=auth(sales),
        json={"reason": "item discontinued"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"


# --- Quote approval workflow -------------------------------------------------


async def _sales_quote(client, sales, eid, item_id, price=90):
    r = await client.post(
        f"/api/v1/admin/enquiries/{eid}/quote",
        headers=auth(sales),
        json={"lines": [{"item_id": item_id, "unit_price": price}], "valid_days": 7},
    )
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.asyncio
async def test_sales_quote_parks_for_approval(client, seeded_catalogue, staff_tokens):
    """A sales rep's quote waits for approval; the customer sees nothing yet."""
    token = await signup_token(client, phone_for("enq-appr-1"), role="retailer")
    enq = await _create(client, token, seeded_catalogue["variant"].id)
    eid, item_id = enq["id"], enq["items"][0]["id"]

    quoted = await _sales_quote(client, staff_tokens["sales"], eid, item_id)
    assert quoted["status"] == "pending"          # customer-facing status unchanged
    assert quoted["approval_status"] == "pending"

    # Customer still can't accept — no quote has been released.
    acc = await client.post(f"/api/v1/enquiries/{eid}/accept", headers=auth(token))
    assert acc.status_code == 409


@pytest.mark.asyncio
async def test_manager_quote_auto_approves(client, seeded_catalogue, staff_tokens):
    token = await signup_token(client, phone_for("enq-appr-2"), role="retailer")
    enq = await _create(client, token, seeded_catalogue["variant"].id)
    eid, item_id = enq["id"], enq["items"][0]["id"]

    quoted = await _sales_quote(client, staff_tokens["manager"], eid, item_id)
    assert quoted["status"] == "quoted"
    assert quoted["approval_status"] == "approved"


@pytest.mark.asyncio
async def test_sales_cannot_approve(client, seeded_catalogue, staff_tokens):
    token = await signup_token(client, phone_for("enq-appr-3"), role="retailer")
    enq = await _create(client, token, seeded_catalogue["variant"].id)
    eid, item_id = enq["id"], enq["items"][0]["id"]
    await _sales_quote(client, staff_tokens["sales"], eid, item_id)

    r = await client.post(f"/api/v1/admin/enquiries/{eid}/approve", headers=auth(staff_tokens["sales"]))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_return_then_requote_then_approve(client, seeded_catalogue, staff_tokens):
    token = await signup_token(client, phone_for("enq-appr-4"), role="retailer")
    enq = await _create(client, token, seeded_catalogue["variant"].id)
    eid, item_id = enq["id"], enq["items"][0]["id"]
    await _sales_quote(client, staff_tokens["sales"], eid, item_id, price=90)

    # Manager returns it to the rep.
    ret = await client.post(
        f"/api/v1/admin/enquiries/{eid}/return",
        headers=auth(staff_tokens["manager"]),
        json={"reason": "margin too low"},
    )
    assert ret.status_code == 200
    assert ret.json()["approval_status"] == "returned"
    assert ret.json()["status"] == "pending"

    # Rep re-quotes → pending approval again.
    requoted = await _sales_quote(client, staff_tokens["sales"], eid, item_id, price=110)
    assert requoted["approval_status"] == "pending"

    # Admin approves (admin approval also releases).
    appr = await client.post(f"/api/v1/admin/enquiries/{eid}/approve", headers=auth(staff_tokens["admin"]))
    assert appr.status_code == 200
    assert appr.json()["status"] == "quoted"
    assert appr.json()["approval_status"] == "approved"

    # Now the customer can accept.
    acc = await client.post(f"/api/v1/enquiries/{eid}/accept", headers=auth(token))
    assert acc.status_code == 200
    assert acc.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_approve_requires_pending_quote(client, seeded_catalogue, staff_tokens):
    """Approving an enquiry with no drafted quote is a conflict."""
    token = await signup_token(client, phone_for("enq-appr-5"), role="retailer")
    enq = await _create(client, token, seeded_catalogue["variant"].id)
    r = await client.post(
        f"/api/v1/admin/enquiries/{enq['id']}/approve", headers=auth(staff_tokens["manager"])
    )
    assert r.status_code == 409
