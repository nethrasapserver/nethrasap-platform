"""Inventory — receive/adjust, reserve-on-checkout, oversell guard, ledger
reconstruction, release-on-cancel, derived status, permission gate."""
from __future__ import annotations

import uuid

import pytest

from .conftest import auth, phone_for, signup_token

ADDRESS = {
    "full_name": "Test Buyer",
    "phone": "9876543210",
    "line1": "10 Main Road",
    "line2": None,
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "country": "IN",
}


async def _receive(client, admin, variant_id, qty, *, reorder=0):
    r = await client.post(
        "/api/v1/admin/inventory/receive",
        headers=auth(admin),
        json={"variant_id": str(variant_id), "quantity": qty, "reorder_point": reorder},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _place_cod(client, token, variant_id, qty=1):
    await client.post(
        "/api/v1/cart/items", headers=auth(token), json={"variant_id": str(variant_id), "quantity": qty}
    )
    r = await client.post(
        "/api/v1/checkout/place",
        headers=auth(token),
        json={"address": ADDRESS, "payment_method": "cod", "client_request_id": str(uuid.uuid4())},
    )
    return r


@pytest.mark.asyncio
async def test_receive_requires_permission(client, seeded_catalogue):
    customer = await signup_token(client, phone_for("inv-customer"))
    r = await client.post(
        "/api/v1/admin/inventory/receive",
        headers=auth(customer),
        json={"variant_id": str(seeded_catalogue["variant"].id), "quantity": 5},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_receive_then_reserve_decrements_available(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    vid = seeded_catalogue["variant"].id
    lvl = await _receive(client, admin, vid, 10, reorder=2)
    assert lvl["on_hand"] == 10 and lvl["available"] == 10

    token = await signup_token(client, phone_for("inv-buyer-1"))
    r = await _place_cod(client, token, vid, qty=3)
    assert r.status_code == 201, r.text

    inv = await client.get("/api/v1/admin/inventory", headers=auth(admin))
    row = next(x for x in inv.json() if x["variant_id"] == str(vid))
    assert row["on_hand"] == 10
    assert row["reserved"] == 3
    assert row["available"] == 7


@pytest.mark.asyncio
async def test_oversell_is_blocked(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    vid = seeded_catalogue["variant"].id
    await _receive(client, admin, vid, 2)

    token = await signup_token(client, phone_for("inv-buyer-2"))
    r = await _place_cod(client, token, vid, qty=5)
    assert r.status_code == 409
    assert "insufficient stock" in r.text.lower()

    # Nothing reserved after the failed attempt.
    inv = await client.get("/api/v1/admin/inventory", headers=auth(admin))
    row = next(x for x in inv.json() if x["variant_id"] == str(vid))
    assert row["reserved"] == 0 and row["available"] == 2


@pytest.mark.asyncio
async def test_last_unit_second_order_fails(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    vid = seeded_catalogue["variant"].id
    await _receive(client, admin, vid, 1)

    a = await signup_token(client, phone_for("inv-race-a"))
    b = await signup_token(client, phone_for("inv-race-b"))
    r1 = await _place_cod(client, a, vid, qty=1)
    r2 = await _place_cod(client, b, vid, qty=1)
    assert r1.status_code == 201
    assert r2.status_code == 409  # exactly one wins the last unit


@pytest.mark.asyncio
async def test_untracked_variant_sells_freely(client, seeded_catalogue):
    # No stock received → variant is untracked → checkout doesn't gate.
    vid = seeded_catalogue["variant"].id
    token = await signup_token(client, phone_for("inv-untracked"))
    r = await _place_cod(client, token, vid, qty=999)
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_cancel_releases_reservation(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    vid = seeded_catalogue["variant"].id
    await _receive(client, admin, vid, 5)

    token = await signup_token(client, phone_for("inv-cancel"))
    place = await _place_cod(client, token, vid, qty=4)
    order_number = place.json()["order_number"]

    inv = await client.get("/api/v1/admin/inventory", headers=auth(admin))
    assert next(x for x in inv.json() if x["variant_id"] == str(vid))["available"] == 1

    cancel = await client.post(f"/api/v1/orders/{order_number}/cancel", headers=auth(token), json={})
    assert cancel.status_code == 200, cancel.text

    inv = await client.get("/api/v1/admin/inventory", headers=auth(admin))
    row = next(x for x in inv.json() if x["variant_id"] == str(vid))
    assert row["reserved"] == 0 and row["available"] == 5


@pytest.mark.asyncio
async def test_derived_status_flips_out_of_stock(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    vid = seeded_catalogue["variant"].id
    await _receive(client, admin, vid, 3, reorder=2)

    # Reserve everything → available 0 → out_of_stock on the storefront.
    token = await signup_token(client, phone_for("inv-status"))
    r = await _place_cod(client, token, vid, qty=3)
    assert r.status_code == 201

    detail = await client.get("/api/v1/products/amoxicillin-500mg-capsules")
    assert detail.json()["stock_status"] == "out_of_stock"


@pytest.mark.asyncio
async def test_ledger_reconstructs_levels(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    vid = seeded_catalogue["variant"].id
    await _receive(client, admin, vid, 10)
    token = await signup_token(client, phone_for("inv-ledger"))
    place = await _place_cod(client, token, vid, qty=4)
    await client.post(f"/api/v1/orders/{place.json()['order_number']}/cancel", headers=auth(token), json={})
    await _place_cod(client, await signup_token(client, phone_for("inv-ledger-2")), vid, qty=2)

    ledger = await client.get(
        f"/api/v1/admin/inventory/ledger?variant_id={vid}", headers=auth(admin)
    )
    entries = ledger.json()
    # No fulfillment in B3 (dispatch is B4), so on_hand and reserved each
    # reconstruct from disjoint movement classes by summing signed quantities.
    on_hand = sum(e["quantity"] for e in entries if e["movement"] in ("receipt", "adjustment", "return"))
    reserved = sum(e["quantity"] for e in entries if e["movement"] in ("reservation", "release"))

    inv = await client.get("/api/v1/admin/inventory", headers=auth(admin))
    row = next(x for x in inv.json() if x["variant_id"] == str(vid))
    assert on_hand == row["on_hand"] == 10  # 4 reserved+released, 2 reserved → on_hand untouched
    assert reserved == row["reserved"] == 2


@pytest.mark.asyncio
async def test_adjust_guard_below_reserved(client, seeded_catalogue, staff_tokens):
    admin = staff_tokens["admin"]
    vid = seeded_catalogue["variant"].id
    await _receive(client, admin, vid, 5)
    token = await signup_token(client, phone_for("inv-adjust"))
    await _place_cod(client, token, vid, qty=4)  # reserved 4

    # Can't drop on_hand below the 4 reserved.
    r = await client.post(
        "/api/v1/admin/inventory/adjust",
        headers=auth(admin),
        json={"variant_id": str(vid), "delta": -3, "reason": "stocktake shrink"},
    )
    assert r.status_code == 409
