"""Admin orders queue — filter and pagination contract."""
from __future__ import annotations

import uuid

import pytest

from .conftest import auth, phone_for, signup_token

ADDRESS = {
    "full_name": "Filter Buyer",
    "phone": "9876543210",
    "line1": "10 Main Road",
    "line2": None,
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "IN",
}


async def _place_cod(client, token) -> str:
    r = await client.post(
        "/api/v1/checkout/place",
        headers=auth(token),
        json={"address": ADDRESS, "payment_method": "cod", "client_request_id": str(uuid.uuid4())},
    )
    assert r.status_code == 201, r.text
    return r.json()["order_number"]


@pytest.mark.asyncio
async def test_admin_orders_filters_and_pagination(client, seeded_catalogue, staff_tokens):
    buyer = await signup_token(client, phone_for("admin-orders-filter"))
    variant_id = str(seeded_catalogue["variant"].id)
    numbers = []
    for _ in range(3):
        r = await client.post(
            "/api/v1/cart/items", headers=auth(buyer), json={"variant_id": variant_id, "quantity": 1}
        )
        assert r.status_code == 201, r.text
        numbers.append(await _place_cod(client, buyer))

    admin = staff_tokens["admin"]

    # Pagination: limit/offset slice a stable newest-first ordering.
    page1 = (await client.get("/api/v1/admin/orders?limit=2&offset=0", headers=auth(admin))).json()
    page2 = (await client.get("/api/v1/admin/orders?limit=2&offset=2", headers=auth(admin))).json()
    assert page1["total"] == page2["total"] >= 3
    ids1 = {o["order_number"] for o in page1["items"]}
    ids2 = {o["order_number"] for o in page2["items"]}
    assert ids1.isdisjoint(ids2)

    # q matches order number…
    r = (await client.get(f"/api/v1/admin/orders?q={numbers[0]}", headers=auth(admin))).json()
    assert r["total"] == 1 and r["items"][0]["order_number"] == numbers[0]

    # …and the customer's phone.
    phone = phone_for("admin-orders-filter").lstrip("+")
    r = (await client.get(f"/api/v1/admin/orders?q={phone}", headers=auth(admin))).json()
    assert r["total"] >= 3

    # payment_status filter: fresh COD orders are cod_pending, none captured.
    r = (await client.get("/api/v1/admin/orders?payment_status=cod_pending", headers=auth(admin))).json()
    assert {o["payment_status"] for o in r["items"]} <= {"cod_pending"}
    assert r["total"] >= 3

    # Bad enum values are a 400, not a 500.
    assert (await client.get("/api/v1/admin/orders?status=bogus", headers=auth(admin))).status_code == 400
    assert (
        await client.get("/api/v1/admin/orders?payment_status=bogus", headers=auth(admin))
    ).status_code == 400

    # Date range: everything today; nothing before 2000.
    r = (await client.get("/api/v1/admin/orders?date_to=1999-12-31", headers=auth(admin))).json()
    assert r["total"] == 0
