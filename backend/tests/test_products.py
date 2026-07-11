"""Catalogue tests — list, search, role-aware pricing, single product."""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_list_products_returns_seeded(client, seeded_catalogue):
    resp = await client.get("/api/v1/products?limit=10")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    assert body["items"][0]["slug"] == "amoxicillin-500mg-capsules"


@pytest.mark.asyncio
async def test_list_products_full_text_search(client, seeded_catalogue):
    resp = await client.get("/api/v1/products?q=amoxicillin")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1

    no_match = await client.get("/api/v1/products?q=ibuprofen")
    assert no_match.status_code == 200
    assert no_match.json()["total"] == 0


@pytest.mark.asyncio
async def test_list_products_category_filter(client, seeded_catalogue):
    ok = await client.get("/api/v1/products?category=prescription")
    assert ok.status_code == 200
    assert ok.json()["total"] >= 1

    none = await client.get("/api/v1/products?category=wellness")
    assert none.status_code == 200
    assert none.json()["total"] == 0


@pytest.mark.asyncio
async def test_anonymous_sees_customer_price(client, seeded_catalogue):
    """Anonymous caller -> customer-tier price (100)."""
    resp = await client.get("/api/v1/products?limit=1")
    item = resp.json()["items"][0]
    assert item["price_min"] == 100  # customer price seeded in conftest


@pytest.mark.asyncio
async def test_retailer_sees_retailer_price(client, seeded_catalogue):
    """Logged-in active retailer -> retailer-tier price (85)."""
    sign = await client.post(
        "/api/v1/auth/signup",
        json={
            "role": "retailer",
            "email": "ret@example.in",
            "password": "Strongp@ss123",
            "name": "Retail Co",
        },
    )
    # signup leaves retailer in pending_kyc — pricing gates on active KYC, so
    # this asserts the *pending* retailer falls back to customer pricing.
    token = sign.json()["access_token"]
    resp = await client.get(
        "/api/v1/products?limit=1",
        headers={"Authorization": f"Bearer {token}"},
    )
    item = resp.json()["items"][0]
    # pending_kyc retailer falls back to customer pricing in catalogue.py
    assert item["price_min"] == 100


@pytest.mark.asyncio
async def test_get_product_by_slug(client, seeded_catalogue):
    resp = await client.get("/api/v1/products/amoxicillin-500mg-capsules")
    assert resp.status_code == 200
    body = resp.json()
    assert body["slug"] == "amoxicillin-500mg-capsules"
    assert body["variants"]
    prices = body["variants"][0]["prices"]
    assert {p["role"] for p in prices} == {"customer", "clinician", "retailer"}


@pytest.mark.asyncio
async def test_get_product_404(client, seeded_catalogue):
    resp = await client.get("/api/v1/products/does-not-exist")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Phase 2 — filter/sort additions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_brand_filter_single(client, multi_catalogue):
    resp = await client.get("/api/v1/products?brand=Cipla")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert items, "expected Cipla results"
    assert {i["brand"] for i in items} == {"Cipla"}


@pytest.mark.asyncio
async def test_brand_filter_multiple_comma_separated(client, multi_catalogue):
    resp = await client.get("/api/v1/products?brand=Cipla,Sun Pharma&limit=20")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert {i["brand"] for i in items} == {"Cipla", "Sun Pharma"}


@pytest.mark.asyncio
async def test_subcategory_filter_case_insensitive(client, multi_catalogue):
    upper = await client.get("/api/v1/products?sub_category=Antibiotics")
    lower = await client.get("/api/v1/products?sub_category=antibiotics")
    assert upper.status_code == 200 and lower.status_code == 200
    assert upper.json()["total"] == lower.json()["total"] > 0
    for r in (upper, lower):
        assert all(i["sub_category"] == "Antibiotics" for i in r.json()["items"])


@pytest.mark.asyncio
async def test_sort_price_ascending(client, multi_catalogue):
    resp = await client.get("/api/v1/products?sort=price-asc&limit=20")
    assert resp.status_code == 200
    prices = [i["price_min"] for i in resp.json()["items"]]
    assert prices == sorted(prices), f"expected ascending, got {prices}"


@pytest.mark.asyncio
async def test_sort_price_descending(client, multi_catalogue):
    resp = await client.get("/api/v1/products?sort=price-desc&limit=20")
    assert resp.status_code == 200
    prices = [i["price_min"] for i in resp.json()["items"]]
    assert prices == sorted(prices, reverse=True), f"expected descending, got {prices}"


@pytest.mark.asyncio
async def test_sort_rating(client, multi_catalogue):
    resp = await client.get("/api/v1/products?sort=rating&limit=20")
    assert resp.status_code == 200
    ratings = [i["rating"] for i in resp.json()["items"]]
    assert ratings == sorted(ratings, reverse=True), f"expected rating desc, got {ratings}"


@pytest.mark.asyncio
async def test_sort_popular_by_reviews(client, multi_catalogue):
    resp = await client.get("/api/v1/products?sort=popular&limit=20")
    assert resp.status_code == 200
    reviews = [i["reviews"] for i in resp.json()["items"]]
    assert reviews == sorted(reviews, reverse=True), f"expected reviews desc, got {reviews}"


@pytest.mark.asyncio
async def test_invalid_sort_returns_422(client):
    resp = await client.get("/api/v1/products?sort=bogus")
    # FastAPI validates against Literal — 422 from pydantic
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_sort_overrides_relevance_when_q_present(client, multi_catalogue):
    # Both `q=` and explicit `sort=price-asc` — sort wins.
    resp = await client.get("/api/v1/products?q=mg&sort=price-asc&limit=20")
    assert resp.status_code == 200
    items = resp.json()["items"]
    prices = [i["price_min"] for i in items]
    assert prices == sorted(prices), f"expected price-asc to win, got {prices}"


@pytest.mark.asyncio
async def test_combined_filters(client, multi_catalogue):
    resp = await client.get(
        "/api/v1/products?brand=Cipla&sub_category=antibiotics&sort=rating"
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(i["brand"] == "Cipla" for i in items)
    assert all(i["sub_category"] == "Antibiotics" for i in items)
    ratings = [i["rating"] for i in items]
    assert ratings == sorted(ratings, reverse=True)
