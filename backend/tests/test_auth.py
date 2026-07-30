"""Auth flow tests — OTP, signup, login, refresh rotation, reuse detection,
password reset, me. Identity is phone-first: no email anywhere."""
from __future__ import annotations

import pytest

from .conftest import get_otp_token, last_otp_for, signup, signup_token


@pytest.mark.asyncio
async def test_signup_requires_verified_phone(client):
    # No OTP proof -> 401 from the proof check, not a created account.
    resp = await client.post(
        "/api/v1/auth/signup",
        json={
            "role": "retailer",
            "otp_token": "not-a-real-proof-token",
            "password": "Strongp@ss123",
            "name": "Asha Pharma",
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_signup_creates_user_and_returns_tokens(client):
    resp = await signup(client, "+919876500001", role="retailer", name="Asha Pharma")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["expires_in"] > 0


@pytest.mark.asyncio
async def test_signup_rejects_portal_roles(client):
    otp_token = await get_otp_token(client, "+919876500002", "signup")
    resp = await client.post(
        "/api/v1/auth/signup",
        json={
            "role": "admin",
            "otp_token": otp_token,
            "password": "Strongp@ss123",
            "name": "Intruder",
        },
    )
    assert resp.status_code == 422  # pydantic enum validation


@pytest.mark.asyncio
async def test_signup_duplicate_phone_conflicts(client):
    first = await signup(client, "+919876500003")
    assert first.status_code == 201
    second = await signup(client, "+919876500003")
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_otp_wrong_code_rejected(client):
    phone = "+919876500004"
    r = await client.post("/api/v1/auth/otp/request", json={"phone": phone, "purpose": "signup"})
    assert r.status_code == 202
    wrong = "000000" if last_otp_for(phone) != "000000" else "111111"
    r = await client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": phone, "purpose": "signup", "code": wrong},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_otp_proof_is_purpose_bound(client):
    # A signup proof must not work for password reset.
    phone = "+919876500005"
    await signup(client, phone)
    signup_proof = await get_otp_token(client, phone, "signup")
    resp = await client.post(
        "/api/v1/auth/password/reset",
        json={"otp_token": signup_proof, "new_password": "NewStr0ngPass!"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_password_happy_path(client):
    phone = "+919876500006"
    await signup(client, phone, password="rightpassword1")
    resp = await client.post(
        "/api/v1/auth/login", json={"phone": phone, "password": "rightpassword1"}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["access_token"]


@pytest.mark.asyncio
async def test_login_accepts_unnormalized_phone_input(client):
    await signup(client, "+919876500007", password="rightpassword1")
    resp = await client.post(
        "/api/v1/auth/login",
        json={"phone": "098765 00007", "password": "rightpassword1"},
    )
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client):
    phone = "+919876500008"
    await signup(client, phone, password="rightpassword1")
    resp = await client.post(
        "/api/v1/auth/login", json={"phone": phone, "password": "wrongpassword"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_otp_login_returns_tokens(client):
    phone = "+919876500009"
    await signup(client, phone)
    r = await client.post("/api/v1/auth/otp/request", json={"phone": phone, "purpose": "login"})
    assert r.status_code == 202
    r = await client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": phone, "purpose": "login", "code": last_otp_for(phone)},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"] and body["refresh_token"]


@pytest.mark.asyncio
async def test_otp_login_unknown_phone_404(client):
    phone = "+919876500010"
    r = await client.post("/api/v1/auth/otp/request", json={"phone": phone, "purpose": "login"})
    assert r.status_code == 202
    r = await client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": phone, "purpose": "login", "code": last_otp_for(phone)},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_password_reset_revokes_sessions(client):
    phone = "+919876500011"
    sign = await signup(client, phone, password="OldPassword1!")
    old_refresh = sign.json()["refresh_token"]

    reset_proof = await get_otp_token(client, phone, "reset")
    resp = await client.post(
        "/api/v1/auth/password/reset",
        json={"otp_token": reset_proof, "new_password": "NewPassword1!"},
    )
    assert resp.status_code == 204

    # Old refresh token is dead; old password no longer works; new one does.
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert r.status_code == 401
    r = await client.post("/api/v1/auth/login", json={"phone": phone, "password": "OldPassword1!"})
    assert r.status_code == 401
    r = await client.post("/api/v1/auth/login", json={"phone": phone, "password": "NewPassword1!"})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_refresh_rotates_tokens_and_invalidates_old(client):
    sign = await signup(client, "+919876500012")
    refresh1 = sign.json()["refresh_token"]

    # This test exercises BODY-token rotation; the auth endpoints also set the
    # nethra_rt cookie, which takes precedence — keep the jar empty throughout.
    client.cookies.clear()

    # First refresh — should rotate and return a new pair.
    r1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh1})
    assert r1.status_code == 200, r1.text
    refresh2 = r1.json()["refresh_token"]
    assert refresh2 != refresh1

    # New refresh works. (Refresh responses re-set the cookie on every
    # rotation, so clear the jar before each body-based call.)
    client.cookies.clear()
    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh2})
    assert r2.status_code == 200

    # Re-using the original (revoked) token must fail and trip reuse detection.
    client.cookies.clear()
    r3 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh1})
    assert r3.status_code == 401

    # Any subsequent token also dead because reuse-detection revoked them all.
    client.cookies.clear()
    r4 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh2})
    assert r4.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_bearer(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_profile(client):
    token = await signup_token(client, "+919876500013", role="clinician")

    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["phone"] == "+919876500013"
    assert body["role"] == "clinician"
    assert body["status"] == "pending_kyc"
    assert body["phone_verified"] is True
    assert "email" not in body


@pytest.mark.asyncio
async def test_logout_revokes_refresh(client):
    sign = await signup(client, "+919876500014")
    refresh = sign.json()["refresh_token"]

    out = await client.post("/api/v1/auth/logout", json={"refresh_token": refresh})
    assert out.status_code == 204

    # Refresh now fails.
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert resp.status_code == 401
