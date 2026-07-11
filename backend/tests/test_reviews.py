"""Review tests — list, upsert, denorm trigger, auth gate."""
from __future__ import annotations

import pytest

from .conftest import phone_for, signup_token


async def _signup_and_token(client, ident: str, role: str = "customer") -> str:
    """Signup via the phone-first OTP flow; `ident` maps to a stable phone."""
    return await signup_token(
        client, phone_for(ident), role=role, name=f"Reviewer {ident.split('@')[0].title()}"
    )


@pytest.mark.asyncio
async def test_list_reviews_empty(client, seeded_catalogue):
    resp = await client.get(
        "/api/v1/products/amoxicillin-500mg-capsules/reviews"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["items"] == []


@pytest.mark.asyncio
async def test_list_reviews_404_unknown_slug(client, seeded_catalogue):
    resp = await client.get("/api/v1/products/does-not-exist/reviews")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_review_requires_auth(client, seeded_catalogue):
    resp = await client.post(
        "/api/v1/products/amoxicillin-500mg-capsules/reviews",
        json={"rating": 5, "title": "Great", "body": "Stocked everywhere."},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_review_happy_path(client, seeded_catalogue):
    token = await _signup_and_token(client, "review1@example.com")
    resp = await client.post(
        "/api/v1/products/amoxicillin-500mg-capsules/reviews",
        json={"rating": 5, "title": "Great", "body": "Stocked everywhere."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["rating"] == 5
    assert body["title"] == "Great"
    assert body["author"]["full_name"].startswith("Reviewer")
    assert body["author"]["role"] == "customer"


@pytest.mark.asyncio
async def test_create_review_upsert_same_user(client, seeded_catalogue):
    token = await _signup_and_token(client, "upsert@example.com")
    first = await client.post(
        "/api/v1/products/amoxicillin-500mg-capsules/reviews",
        json={"rating": 5, "title": "Loved it"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first.status_code == 201
    first_id = first.json()["id"]

    second = await client.post(
        "/api/v1/products/amoxicillin-500mg-capsules/reviews",
        json={"rating": 3, "title": "Changed my mind"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert second.status_code == 201
    assert second.json()["id"] == first_id  # same row
    assert second.json()["rating"] == 3

    listing = await client.get(
        "/api/v1/products/amoxicillin-500mg-capsules/reviews"
    )
    assert listing.json()["total"] == 1  # no duplicate row


@pytest.mark.asyncio
async def test_create_review_rejects_out_of_range_rating(client, seeded_catalogue):
    token = await _signup_and_token(client, "outofrange@example.com")
    for bad in (0, 6, -1):
        resp = await client.post(
            "/api/v1/products/amoxicillin-500mg-capsules/reviews",
            json={"rating": bad, "title": "bad"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422, f"rating={bad} should be rejected"


@pytest.mark.asyncio
async def test_two_users_two_reviews(client, seeded_catalogue):
    t1 = await _signup_and_token(client, "a@example.com")
    t2 = await _signup_and_token(client, "b@example.com")
    await client.post(
        "/api/v1/products/amoxicillin-500mg-capsules/reviews",
        json={"rating": 5},
        headers={"Authorization": f"Bearer {t1}"},
    )
    await client.post(
        "/api/v1/products/amoxicillin-500mg-capsules/reviews",
        json={"rating": 3},
        headers={"Authorization": f"Bearer {t2}"},
    )
    resp = await client.get("/api/v1/products/amoxicillin-500mg-capsules/reviews")
    body = resp.json()
    assert body["total"] == 2
    ratings = sorted(r["rating"] for r in body["items"])
    assert ratings == [3, 5]


@pytest.mark.asyncio
async def test_review_denorm_trigger_updates_product(client, seeded_catalogue):
    """Posting reviews updates products.rating + products.reviews_count via trigger."""
    t1 = await _signup_and_token(client, "denorm1@example.com")
    t2 = await _signup_and_token(client, "denorm2@example.com")

    await client.post(
        "/api/v1/products/amoxicillin-500mg-capsules/reviews",
        json={"rating": 4},
        headers={"Authorization": f"Bearer {t1}"},
    )
    await client.post(
        "/api/v1/products/amoxicillin-500mg-capsules/reviews",
        json={"rating": 2},
        headers={"Authorization": f"Bearer {t2}"},
    )

    detail = await client.get("/api/v1/products/amoxicillin-500mg-capsules")
    body = detail.json()
    assert body["reviews"] == 2
    assert abs(body["rating"] - 3.0) < 0.01  # AVG(4,2) = 3.0
