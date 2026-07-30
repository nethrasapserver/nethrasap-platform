"""PDP field coverage — live availability, tax/regulatory fields, verbatim
attributes, primary-first image ordering on GET /products/{slug}."""
from __future__ import annotations

import pytest
from sqlalchemy import select

SLUG = "amoxicillin-500mg-capsules"
DETAIL_URL = f"/api/v1/products/{SLUG}"


async def _main_warehouse_id(db_session):
    from app.models.inventory import Warehouse

    return (
        await db_session.execute(select(Warehouse.id).where(Warehouse.code == "MAIN"))
    ).scalar_one()


@pytest.mark.asyncio
async def test_untracked_variant_has_null_available_units(client, seeded_catalogue):
    """No stock_levels rows → untracked → available_units is null and the
    frontend falls back to product-level stock_status."""
    resp = await client.get(DETAIL_URL)
    assert resp.status_code == 200
    body = resp.json()
    assert body["stock_status"] == "in_stock"  # admin-set, untouched
    variant = next(v for v in body["variants"] if v["is_default"])
    assert variant["available_units"] is None


@pytest.mark.asyncio
async def test_tracked_variant_reports_on_hand_minus_reserved(
    client, db_session, seeded_catalogue
):
    from app.models.inventory import StockLevel

    db_session.add(
        StockLevel(
            variant_id=seeded_catalogue["variant"].id,
            warehouse_id=await _main_warehouse_id(db_session),
            on_hand=30,
            reserved=1,
        )
    )
    await db_session.flush()

    resp = await client.get(DETAIL_URL)
    assert resp.status_code == 200
    variant = next(v for v in resp.json()["variants"] if v["is_default"])
    assert variant["available_units"] == 29


@pytest.mark.asyncio
async def test_detail_carries_hsn_gst_badge_and_verbatim_attributes(
    client, db_session, seeded_catalogue
):
    attributes = {
        "manufacturer": "Cipla Ltd",
        "benefits": ["Treats bacterial infections"],
        "tags": ["antibiotic", "penicillin"],
    }
    product = seeded_catalogue["product"]
    product.hsn_code = "30042039"
    product.badge = "Bestseller"
    product.attributes = attributes
    await db_session.flush()

    resp = await client.get(DETAIL_URL)
    assert resp.status_code == 200
    body = resp.json()
    assert body["hsn_code"] == "30042039"
    assert body["gst_rate_pct"] == 12
    assert body["badge"] == "Bestseller"
    # JSONB passes through verbatim — no reshaping, no dropped keys.
    assert body["attributes"] == attributes


@pytest.mark.asyncio
async def test_images_ordered_primary_first_then_sort_order(
    client, db_session, seeded_catalogue
):
    from app.models.catalogue import ProductImage

    pid = seeded_catalogue["product"].id
    # Deliberately give the primary the HIGHEST sort_order so ordering by
    # sort_order alone would put it last.
    db_session.add_all(
        [
            ProductImage(product_id=pid, storage_key="img/b.webp", sort_order=1),
            ProductImage(product_id=pid, storage_key="img/a.webp", sort_order=0),
            ProductImage(
                product_id=pid, storage_key="img/hero.webp", sort_order=2, is_primary=True
            ),
        ]
    )
    await db_session.flush()

    resp = await client.get(DETAIL_URL)
    assert resp.status_code == 200
    images = resp.json()["images"]
    assert len(images) == 3
    assert images[0]["is_primary"] is True
    # Remaining images keep admin-curated sort_order.
    assert [img["sort_order"] for img in images[1:]] == [0, 1]
