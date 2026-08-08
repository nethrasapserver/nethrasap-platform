"""Staff provisioning — creation, role changes, suspension, lockout guards."""
from __future__ import annotations

import pytest

from .conftest import auth, phone_for, signup_token

STRONG = "StaffPass123!"


async def _create_staff(client, admin: str, *, ident: str, role: str = "sales", name: str = "New Rep"):
    return await client.post(
        "/api/v1/admin/users",
        headers=auth(admin),
        json={"phone": phone_for(ident), "name": name, "role": role, "password": STRONG},
    )


@pytest.mark.asyncio
async def test_admin_provisions_staff_who_can_then_sign_in(client, staff_tokens):
    admin = staff_tokens["admin"]

    r = await _create_staff(client, admin, ident="prov-sales", role="sales")
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["role"] == "sales"
    assert created["status"] == "active"
    # Provisioned accounts are phone-unverified: OTP is unavailable pre-DLT.
    assert created["phone_verified"] is False

    # The whole point — the new rep can log in with the password they were given.
    login = await client.post(
        "/api/v1/auth/login", json={"phone": phone_for("prov-sales"), "password": STRONG}
    )
    assert login.status_code == 200, login.text

    # …and shows up in the team list.
    listing = (await client.get("/api/v1/admin/users", headers=auth(admin))).json()
    assert any(u["phone"] == phone_for("prov-sales") for u in listing["items"])


@pytest.mark.asyncio
async def test_staff_creation_is_validated(client, staff_tokens):
    admin = staff_tokens["admin"]

    # Customers are not provisioned here — they sign themselves up.
    r = await _create_staff(client, admin, ident="prov-cust", role="customer")
    assert r.status_code == 422  # Literal[...] rejects it at the schema

    # Weak passwords are refused.
    r = await client.post(
        "/api/v1/admin/users",
        headers=auth(admin),
        json={"phone": phone_for("prov-weak"), "name": "Weak", "role": "sales", "password": "short"},
    )
    assert r.status_code == 422

    # Duplicate phone → 409, not a 500.
    await _create_staff(client, admin, ident="prov-dupe")
    again = await _create_staff(client, admin, ident="prov-dupe")
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_non_admin_cannot_provision_staff(client, staff_tokens):
    """Sales can't mint accounts — that's the whole containment boundary."""
    r = await _create_staff(client, staff_tokens["sales"], ident="prov-bysales")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_customer_cannot_reach_the_team_console(client):
    token = await signup_token(client, phone_for("prov-outsider"))
    assert (await client.get("/api/v1/admin/users", headers=auth(token))).status_code == 403


@pytest.mark.asyncio
async def test_role_change_and_suspension(client, staff_tokens):
    admin = staff_tokens["admin"]
    created = (await _create_staff(client, admin, ident="prov-promote")).json()
    uid = created["id"]

    promoted = await client.patch(
        f"/api/v1/admin/users/{uid}/role", headers=auth(admin), json={"role": "manager"}
    )
    assert promoted.status_code == 200 and promoted.json()["role"] == "manager"

    suspended = await client.patch(
        f"/api/v1/admin/users/{uid}/status", headers=auth(admin), json={"suspended": True}
    )
    assert suspended.status_code == 200 and suspended.json()["status"] == "suspended"

    # Suspension bites immediately — the DB status is checked on every request.
    login = await client.post(
        "/api/v1/auth/login", json={"phone": phone_for("prov-promote"), "password": STRONG}
    )
    if login.status_code == 200:
        me = await client.get(
            "/api/v1/admin/users", headers=auth(login.json()["access_token"])
        )
        assert me.status_code == 403

    back = await client.patch(
        f"/api/v1/admin/users/{uid}/status", headers=auth(admin), json={"suspended": False}
    )
    assert back.json()["status"] == "active"


@pytest.mark.asyncio
async def test_admin_cannot_lock_themselves_out(client, staff_tokens, db_session):
    """Self-demotion and self-suspension are refused — otherwise a one-admin
    platform can be stranded with no way back in."""
    admin = staff_tokens["admin"]
    me = (await client.get("/api/v1/auth/me", headers=auth(admin))).json()
    uid = me["id"]

    demote = await client.patch(
        f"/api/v1/admin/users/{uid}/role", headers=auth(admin), json={"role": "sales"}
    )
    assert demote.status_code == 409

    suspend = await client.patch(
        f"/api/v1/admin/users/{uid}/status", headers=auth(admin), json={"suspended": True}
    )
    assert suspend.status_code == 409


@pytest.mark.asyncio
async def test_password_reset_lets_the_new_password_work(client, staff_tokens):
    admin = staff_tokens["admin"]
    created = (await _create_staff(client, admin, ident="prov-reset")).json()

    new_password = "RotatedPass456!"
    r = await client.post(
        f"/api/v1/admin/users/{created['id']}/password",
        headers=auth(admin),
        json={"password": new_password},
    )
    assert r.status_code == 200

    assert (
        await client.post(
            "/api/v1/auth/login", json={"phone": phone_for("prov-reset"), "password": new_password}
        )
    ).status_code == 200
    assert (
        await client.post(
            "/api/v1/auth/login", json={"phone": phone_for("prov-reset"), "password": STRONG}
        )
    ).status_code == 401
