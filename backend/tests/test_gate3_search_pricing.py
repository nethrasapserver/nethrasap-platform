"""Gate 3 — product search (CR-4) + role pricing on listings (CR-5).

CR-4: search was whole-word only (`plainto_tsquery`) so `amox`, `para`,
`amoxicillin 500` and `blood pressure` all returned 0. It now uses a prefix +
multi-word `to_tsquery` on the existing products tsvector (no migration).

CR-5: the listing/card price must resolve the SAME role tier as the PDP and
checkout for the authenticated caller. A verified retailer must see the
retailer price on the card, not the customer price.
"""
from __future__ import annotations

import pytest

from .conftest import auth


async def _active_retailer_token(db_session, client) -> str:
    """Insert a KYC-active retailer directly and log in via the real API so
    the token carries a genuine retailer identity (signup leaves pending_kyc,
    which by policy falls back to customer pricing)."""
    from app.models.user import User, UserProfile, UserRole, UserStatus
    from app.security import hash_password

    phone = "+919766000123"
    password = "Retailer@Pass123"
    user = User(
        phone=phone,
        password_hash=hash_password(password),
        role=UserRole.retailer,
        status=UserStatus.active,
    )
    user.profile = UserProfile(full_name="Active Retailer")
    db_session.add(user)
    await db_session.flush()

    r = await client.post("/api/v1/auth/login", json={"phone": phone, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# --- CR-4: search ----------------------------------------------------------


@pytest.mark.asyncio
async def test_prefix_search_matches_partial_word(client, seeded_catalogue):
    """`amox` must match "Amoxicillin" (was 0 under plainto_tsquery)."""
    resp = await client.get("/api/v1/products?q=amox")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    assert any(i["slug"] == "amoxicillin-500mg-capsules" for i in body["items"])


@pytest.mark.asyncio
async def test_multi_word_prefix_search(client, seeded_catalogue):
    """`amoxicillin 500` must AND both prefixes and still match (was 0)."""
    resp = await client.get("/api/v1/products?q=amoxicillin%20500")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    assert any(i["slug"] == "amoxicillin-500mg-capsules" for i in body["items"])


@pytest.mark.asyncio
async def test_garbage_query_does_not_500(client, seeded_catalogue):
    """A punctuation-only / whitespace query is not a server error — it falls
    back to the normal list rather than raising a tsquery syntax error."""
    resp = await client.get("/api/v1/products?q=%21%21%21%20%40%23%24")  # "!!! @#$"
    assert resp.status_code == 200
    # No text filter applied → the normal catalogue is returned.
    assert resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_injection_shaped_query_is_safe(client, seeded_catalogue):
    """A tsquery-syntax-breaking / injection-shaped string must not 500."""
    resp = await client.get("/api/v1/products", params={"q": "'; drop table products;--"})
    assert resp.status_code == 200


# --- CR-5: role pricing on listings ---------------------------------------


@pytest.mark.asyncio
async def test_listing_card_price_matches_retailer_tier_and_pdp(
    client, db_session, seeded_catalogue
):
    """The card price a verified retailer sees on the LIST must equal the
    retailer selling price (85) — the same tier the PDP shows and checkout
    charges — NOT the customer price (100)."""
    token = await _active_retailer_token(db_session, client)
    slug = "amoxicillin-500mg-capsules"

    # LIST / card
    listing = await client.get("/api/v1/products?limit=1", headers=auth(token))
    assert listing.status_code == 200
    card = listing.json()["items"][0]
    assert card["slug"] == slug
    assert card["price_min"] == 85  # retailer tier, not 100 (customer)

    # PDP detail resolves the same tier for the same caller...
    pdp = await client.get(f"/api/v1/products/{slug}", headers=auth(token))
    assert pdp.status_code == 200
    pdp_body = pdp.json()
    assert pdp_body["price_min"] == card["price_min"]

    # ...and that number is the actual retailer selling-price row (what checkout
    # charges), proving price-shown == price-charged.
    variant = next(v for v in pdp_body["variants"] if v["is_default"])
    retailer_row = next(p for p in variant["prices"] if p["role"] == "retailer")
    assert retailer_row["selling_price"] == 85
    assert card["price_min"] == retailer_row["selling_price"]


@pytest.mark.asyncio
async def test_anonymous_listing_card_stays_customer_tier(client, seeded_catalogue):
    """Anonymous callers keep base/customer pricing on the card."""
    resp = await client.get("/api/v1/products?limit=1")
    assert resp.status_code == 200
    assert resp.json()["items"][0]["price_min"] == 100
