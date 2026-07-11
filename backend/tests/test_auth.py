"""Auth flow tests — signup, login, refresh rotation, reuse detection, me."""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_signup_creates_user_and_returns_tokens(client):
    resp = await client.post(
        "/api/v1/auth/signup",
        json={
            "role": "retailer",
            "email": "asha@nethrasap.in",
            "password": "Strongp@ss123",
            "name": "Asha Pharma",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["expires_in"] > 0


@pytest.mark.asyncio
async def test_signup_rejects_portal_roles(client):
    resp = await client.post(
        "/api/v1/auth/signup",
        json={
            "role": "admin",
            "email": "intruder@example.com",
            "password": "Strongp@ss123",
            "name": "Intruder",
        },
    )
    assert resp.status_code == 422  # pydantic enum validation


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client):
    await client.post(
        "/api/v1/auth/signup",
        json={
            "role": "customer",
            "email": "priya@nethrasap.in",
            "password": "rightpassword1",
            "name": "Priya Iyer",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "priya@nethrasap.in", "password": "wrongpassword"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_rotates_tokens_and_invalidates_old(client):
    sign = await client.post(
        "/api/v1/auth/signup",
        json={
            "role": "customer",
            "email": "rotate@nethrasap.in",
            "password": "Strongp@ss123",
            "name": "Rotate Tester",
        },
    )
    refresh1 = sign.json()["refresh_token"]

    # First refresh — should rotate and return a new pair.
    r1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh1})
    assert r1.status_code == 200, r1.text
    refresh2 = r1.json()["refresh_token"]
    assert refresh2 != refresh1

    # New refresh works.
    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh2})
    assert r2.status_code == 200

    # Re-using the original (revoked) token must fail and trip reuse detection.
    r3 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh1})
    assert r3.status_code == 401

    # Any subsequent token also dead because reuse-detection revoked them all.
    r4 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh2})
    assert r4.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_bearer(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_profile(client):
    sign = await client.post(
        "/api/v1/auth/signup",
        json={
            "role": "clinician",
            "email": "arjun@nethrasap.in",
            "password": "Strongp@ss123",
            "name": "Dr. Arjun Mehta",
        },
    )
    token = sign.json()["access_token"]

    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == "arjun@nethrasap.in"
    assert body["role"] == "clinician"
    assert body["status"] == "pending_kyc"
    assert body["profile"]["full_name"] == "Dr. Arjun Mehta"


@pytest.mark.asyncio
async def test_logout_revokes_refresh(client):
    sign = await client.post(
        "/api/v1/auth/signup",
        json={
            "role": "customer",
            "email": "logout@nethrasap.in",
            "password": "Strongp@ss123",
            "name": "Logout Tester",
        },
    )
    refresh = sign.json()["refresh_token"]

    out = await client.post("/api/v1/auth/logout", json={"refresh_token": refresh})
    assert out.status_code == 204

    # Refresh now fails.
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert resp.status_code == 401
