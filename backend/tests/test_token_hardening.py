"""Token hardening: typ confusion, malformed subjects, suspension, jti revocation."""
from __future__ import annotations

import pytest
from sqlalchemy import update

from app.models.user import User, UserStatus
from app.security import make_access_token, make_phone_proof_token

from .conftest import get_otp_token, signup

pytestmark = pytest.mark.asyncio


async def test_phone_proof_token_rejected_as_bearer(client):
    """A phone-proof token must be a clean 401, never a 500 (typ confusion)."""
    token = make_phone_proof_token(phone="+919877000001", purpose="signup")
    resp = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 401


async def test_real_otp_proof_rejected_as_bearer(client):
    """Same via the live OTP flow — the exact attack from the audit."""
    otp_token = await get_otp_token(client, "+919877000002", "signup")
    resp = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {otp_token}"}
    )
    assert resp.status_code == 401


async def test_non_uuid_sub_rejected_not_500(client):
    """A validly-signed access token with a garbage sub is 401, not 500."""
    token = make_access_token(
        sub="+919877000003", role="customer", kyc_status="none", permissions=[]
    )
    resp = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 401


async def test_suspended_user_locked_out_mid_token(client, db_session):
    """Suspension cuts off in-flight access tokens (403), token expiry or not."""
    signup_resp = await signup(client, "+919877000004")
    assert signup_resp.status_code == 201
    access = signup_resp.json()["access_token"]

    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"}
    )
    assert me.status_code == 200

    await db_session.execute(
        update(User)
        .where(User.phone == "+919877000004")
        .values(status=UserStatus.suspended)
    )
    await db_session.commit()

    resp = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"}
    )
    assert resp.status_code == 403
    assert "suspended" in resp.json()["detail"]


async def test_logout_revokes_access_token(client):
    """After logout the old access token is dead immediately (jti denylist)."""
    signup_resp = await signup(client, "+919877000005")
    assert signup_resp.status_code == 201
    pair = signup_resp.json()
    access, refresh = pair["access_token"], pair["refresh_token"]

    out = await client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh},
        headers={"Authorization": f"Bearer {access}"},
    )
    assert out.status_code == 204

    resp = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"}
    )
    assert resp.status_code == 401
