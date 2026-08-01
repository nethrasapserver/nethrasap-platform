"""Gate 1 — inventory-integrity regressions.

Covers the CR-2 / H-6 remediation:
  * RFQ conversion must reserve stock through the same path cart checkout uses,
    so it can no longer bypass the oversell guard (CR-2 part 1).
  * fulfil_for_order must RAISE on a shortfall for a tracked variant instead of
    silently clamping, so an unbacked dispatch fails loudly (CR-2 part 2).

Mirrors the fixtures/patterns in tests/test_inventory.py and
tests/test_enquiries.py.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.inventory import StockLedger, StockLevel, StockMovement
from app.models.order import Order

from .conftest import auth, phone_for, signup_token


async def _receive(client, admin, variant_id, qty, *, reorder=0):
    r = await client.post(
        "/api/v1/admin/inventory/receive",
        headers=auth(admin),
        json={"variant_id": str(variant_id), "quantity": qty, "reorder_point": reorder},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _drive_to_confirmed(client, customer, manager, variant_id, *, qty, unit_price):
    """create enquiry → manager quotes (auto-approves) → customer accepts."""
    r = await client.post(
        "/api/v1/enquiries",
        headers=auth(customer),
        json={"items": [{"variant_id": str(variant_id), "quantity": qty}], "note": "gate1"},
    )
    assert r.status_code == 201, r.text
    enq = r.json()
    eid, item_id = enq["id"], enq["items"][0]["id"]

    q = await client.post(
        f"/api/v1/admin/enquiries/{eid}/quote",
        headers=auth(manager),
        json={"lines": [{"item_id": item_id, "unit_price": unit_price}], "valid_days": 7},
    )
    assert q.status_code == 200, q.text
    assert q.json()["status"] == "quoted"

    acc = await client.post(f"/api/v1/enquiries/{eid}/accept", headers=auth(customer))
    assert acc.status_code == 200, acc.text
    assert acc.json()["status"] == "confirmed"
    return eid


async def _level(db_session, variant_id) -> StockLevel:
    return (
        await db_session.execute(
            select(StockLevel)
            .where(StockLevel.variant_id == variant_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one()


async def _reservation_rows(db_session, variant_id) -> list[StockLedger]:
    return list(
        (
            await db_session.execute(
                select(StockLedger).where(
                    StockLedger.variant_id == variant_id,
                    StockLedger.movement == StockMovement.reservation,
                )
            )
        ).scalars()
    )


# --- CR-2: convert must not oversell -----------------------------------------


@pytest.mark.asyncio
async def test_convert_over_available_fails_and_writes_nothing(
    client, db_session, seeded_catalogue, staff_tokens
):
    """Converting an enquiry whose quantity exceeds available stock must fail
    cleanly (409) and create NO order and NO reservation ledger rows."""
    admin, manager, sales = (
        staff_tokens["admin"],
        staff_tokens["manager"],
        staff_tokens["sales"],
    )
    vid = seeded_catalogue["variant"].id
    await _receive(client, admin, vid, 2)  # tracked, available = 2

    customer = await signup_token(client, phone_for("g1-oversell"), role="retailer")
    eid = await _drive_to_confirmed(client, customer, manager, vid, qty=3, unit_price=100)

    conv = await client.post(f"/api/v1/admin/enquiries/{eid}/convert", headers=auth(sales))
    assert conv.status_code == 409, conv.text
    assert "insufficient stock" in conv.text.lower()

    # No order row was created by the rolled-back conversion.
    orders = (await db_session.execute(select(Order))).scalars().all()
    assert orders == []

    # No reservation ledger rows; reserved untouched at 0, available still 2.
    assert await _reservation_rows(db_session, vid) == []
    level = await _level(db_session, vid)
    assert level.reserved == 0
    assert level.on_hand - level.reserved == 2

    # Enquiry stays confirmed (not converted) — safe to retry after restock.
    detail = await client.get(f"/api/v1/enquiries/{eid}", headers=auth(customer))
    assert detail.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_convert_reserves_stock(client, db_session, seeded_catalogue, staff_tokens):
    """A successful convert reserves stock: reserved increases and a reservation
    ledger row is written against the order number."""
    admin, manager, sales = (
        staff_tokens["admin"],
        staff_tokens["manager"],
        staff_tokens["sales"],
    )
    vid = seeded_catalogue["variant"].id
    await _receive(client, admin, vid, 10)

    customer = await signup_token(client, phone_for("g1-reserve"), role="retailer")
    eid = await _drive_to_confirmed(client, customer, manager, vid, qty=4, unit_price=100)

    conv = await client.post(f"/api/v1/admin/enquiries/{eid}/convert", headers=auth(sales))
    assert conv.status_code == 200, conv.text
    order_number = conv.json()["order_number"]

    level = await _level(db_session, vid)
    assert level.on_hand == 10
    assert level.reserved == 4
    assert level.on_hand - level.reserved == 6

    rows = await _reservation_rows(db_session, vid)
    assert len(rows) == 1
    assert rows[0].quantity == 4
    assert rows[0].ref_type == "order"
    assert rows[0].ref_id == order_number


# --- CR-2 part 2: fulfil must raise on a shortfall ---------------------------


@pytest.mark.asyncio
async def test_fulfil_raises_when_reserved_short_for_tracked_variant(
    client, db_session, seeded_catalogue, staff_tokens
):
    """fulfil_for_order must RAISE 409 (not clamp) when a tracked variant has
    less reserved than the dispatched quantity."""
    from app.services.inventory import (
        LineReservation,
        fulfil_for_order,
        reserve_for_order,
    )

    admin = staff_tokens["admin"]
    vid = seeded_catalogue["variant"].id
    await _receive(client, admin, vid, 5)  # tracked: on_hand 5, reserved 0

    # Reserve only 2, then attempt to dispatch 5 → reserved (2) < qty (5).
    await reserve_for_order(
        db_session,
        lines=[LineReservation(variant_id=vid, quantity=2)],
        order_number="G1-TEST-1",
    )

    with pytest.raises(HTTPException) as ei:
        await fulfil_for_order(
            db_session,
            lines=[LineReservation(variant_id=vid, quantity=5)],
            order_number="G1-TEST-1",
        )
    assert ei.value.status_code == 409

    # Nothing was deducted by the failed fulfil: on_hand intact, reserved intact.
    level = await _level(db_session, vid)
    assert level.on_hand == 5
    assert level.reserved == 2


@pytest.mark.asyncio
async def test_fulfil_untracked_variant_passes_through(
    client, db_session, seeded_catalogue
):
    """Untracked variants (no stock_levels row) still fulfil silently — the
    deliberate B3 policy — so the raise only bites tracked variants."""
    from app.services.inventory import LineReservation, fulfil_for_order

    vid = seeded_catalogue["variant"].id  # no stock received → untracked
    # Must not raise despite no reservation/stock existing.
    await fulfil_for_order(
        db_session,
        lines=[LineReservation(variant_id=vid, quantity=7)],
        order_number="G1-TEST-2",
    )
    assert (
        await db_session.execute(select(StockLevel).where(StockLevel.variant_id == vid))
    ).scalar_one_or_none() is None
