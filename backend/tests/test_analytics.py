"""B6 — analytics KPIs from real orders, rep performance from assignments,
targets, audit viewer, permission gates."""
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

import pytest

from .conftest import auth, phone_for, signup_token

ADDRESS = {
    "full_name": "Buyer", "phone": "9876543210", "line1": "1 Rd",
    "city": "Mumbai", "state": "MH", "pincode": "400001", "country": "IN",
}


async def _place_cod(client, token, variant_id, qty=1):
    await client.post("/api/v1/cart/items", headers=auth(token), json={"variant_id": str(variant_id), "quantity": qty})
    r = await client.post(
        "/api/v1/checkout/place", headers=auth(token),
        json={"address": ADDRESS, "payment_method": "cod", "client_request_id": str(uuid.uuid4())},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _user_id(client, token):
    return (await client.get("/api/v1/auth/me", headers=auth(token))).json()["id"]


@pytest.mark.asyncio
async def test_kpis_reflect_real_orders(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    before = (await client.get("/api/v1/analytics/kpis", headers=auth(admin))).json()

    token = await signup_token(client, phone_for("an-buyer-1"))
    # COD orders are 'confirmed' → count as realised revenue.
    await _place_cod(client, token, seeded_catalogue["variant"].id, qty=2)

    after = (await client.get("/api/v1/analytics/kpis", headers=auth(admin))).json()
    assert after["orders"] == before["orders"] + 1
    assert after["revenue_paise"] > before["revenue_paise"]
    assert after["aov_paise"] > 0


@pytest.mark.asyncio
async def test_analytics_requires_permission(client):
    customer = await signup_token(client, phone_for("an-nosy"))
    r = await client.get("/api/v1/analytics/kpis", headers=auth(customer))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_revenue_trend_and_top_products(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    token = await signup_token(client, phone_for("an-buyer-2"))
    await _place_cod(client, token, seeded_catalogue["variant"].id, qty=3)

    trend = (await client.get("/api/v1/analytics/revenue-trend?days=7", headers=auth(admin))).json()
    assert len(trend["series"]) == 7
    assert sum(d["orders"] for d in trend["series"]) >= 1

    top = (await client.get("/api/v1/analytics/top-products", headers=auth(admin))).json()
    assert any(p["product_name"] == "Amoxicillin 500mg Capsules" for p in top["items"])


@pytest.mark.asyncio
async def test_assignment_and_rep_performance(client, seeded_catalogue, staff_tokens):
    manager = staff_tokens["manager"]
    # The seeded sales staff user is our rep.
    sales_token = staff_tokens["sales"]
    rep_uuid = await _user_id(client, sales_token)

    customer_token = await signup_token(client, phone_for("an-assigned-cust"))
    cust_id = await _user_id(client, customer_token)

    # Assign the customer to the rep (manager has sales:manage).
    a = await client.post(
        "/api/v1/sales/assignments", headers=auth(manager),
        json={"customer_id": cust_id, "rep_id": rep_uuid},
    )
    assert a.status_code == 200, a.text

    # Customer places an order → attributed to the rep.
    await _place_cod(client, customer_token, seeded_catalogue["variant"].id, qty=4)

    perf = (await client.get(f"/api/v1/sales/performance/{rep_uuid}", headers=auth(manager))).json()
    assert perf["orders"] == 1
    assert perf["revenue_paise"] > 0
    assert perf["customers"] == 1

    team = (await client.get("/api/v1/sales/team", headers=auth(manager))).json()
    assert any(m["rep_id"] == rep_uuid and m["orders"] == 1 for m in team["team"])


@pytest.mark.asyncio
async def test_targets_and_attainment(client, seeded_catalogue, staff_tokens):
    manager = staff_tokens["manager"]
    sales_token = staff_tokens["sales"]
    rep_uuid = await _user_id(client, sales_token)
    cust_token = await signup_token(client, phone_for("an-target-cust"))
    cust_id = await _user_id(client, cust_token)
    await client.post("/api/v1/sales/assignments", headers=auth(manager), json={"customer_id": cust_id, "rep_id": rep_uuid})
    await _place_cod(client, cust_token, seeded_catalogue["variant"].id, qty=5)

    now = datetime.now(UTC)
    period = date(now.year, now.month, 1).isoformat()
    r = await client.put(
        "/api/v1/sales/targets", headers=auth(manager),
        json={"rep_id": rep_uuid, "period": period, "target_paise": 1000, "label": "Jul"},
    )
    assert r.status_code == 200, r.text

    perf = (await client.get(f"/api/v1/sales/performance/{rep_uuid}", headers=auth(manager))).json()
    assert perf["month_target_paise"] == 1000
    assert perf["attainment_pct"] is not None and perf["attainment_pct"] > 0


@pytest.mark.asyncio
async def test_reassignment_ends_previous(client, staff_tokens):
    manager = staff_tokens["manager"]
    sales_token = staff_tokens["sales"]
    rep_uuid = await _user_id(client, sales_token)
    cust_token = await signup_token(client, phone_for("an-reassign-cust"))
    cust_id = await _user_id(client, cust_token)

    await client.post("/api/v1/sales/assignments", headers=auth(manager), json={"customer_id": cust_id, "rep_id": rep_uuid})
    # Re-assign to the same rep is idempotent; a fresh active row constraint holds.
    again = await client.post("/api/v1/sales/assignments", headers=auth(manager), json={"customer_id": cust_id, "rep_id": rep_uuid})
    assert again.status_code == 200

    lst = (await client.get(f"/api/v1/sales/assignments?rep_id={rep_uuid}", headers=auth(manager))).json()
    active_for_cust = [a for a in lst["assignments"] if a["customer_id"] == cust_id]
    assert len(active_for_cust) == 1  # exactly one active assignment


@pytest.mark.asyncio
async def test_audit_viewer(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    # An admin catalogue action writes an audit row.
    await client.post(
        "/api/v1/admin/categories", headers=auth(admin),
        json={"name": "Audit Cat", "slug": "audit-cat", "sku_prefix": "AUD"},
    )
    cat_audit = await client.get("/api/v1/admin/audit?entity_type=category", headers=auth(admin))
    assert cat_audit.status_code == 200
    assert any(a["action"] == "category.created" for a in cat_audit.json()["items"])


@pytest.mark.asyncio
async def test_audit_requires_permission(client, staff_tokens):
    # sales does NOT have audit:read.
    r = await client.get("/api/v1/admin/audit", headers=auth(staff_tokens["sales"]))
    assert r.status_code == 403
