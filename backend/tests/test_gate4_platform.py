"""Gate 4 Wave 2 — super-admin Platform Ops console.

Covers:
  (a) customer / sales tokens are rejected (403) on every /platform/* endpoint;
  (b) admin gets 200 on /status with the documented shape;
  (c) admin can list the audit trail and toggle a feature flag — the toggle
      persists AND writes an audit_log row (who/what);
  (d) /integrations returns booleans and leaks no secret values.

The shared `staff_tokens` fixture's admin token does NOT carry `platform:admin`
(its perms come from a hardcoded dict in conftest, not scripts.rbac_data), so
this module provisions its own admin/sales users with the real permission via
the login API. See the note to the lead in the handover.
"""
from __future__ import annotations

import pytest
import pytest_asyncio

from .conftest import STAFF_PASSWORD, auth, phone_for, signup_token

PLATFORM_ADMIN_PHONE = "+919710000001"
PLATFORM_SALES_PHONE = "+919710000002"

# Every write/read endpoint on the console. PUT carries a valid body so a
# rejected caller trips the permission guard (403), not body validation (422).
PLATFORM_ENDPOINTS = [
    ("GET", "/api/v1/platform/status", None),
    ("GET", "/api/v1/platform/audit", None),
    ("GET", "/api/v1/platform/feature-flags", None),
    ("GET", "/api/v1/platform/integrations", None),
    ("PUT", "/api/v1/platform/feature-flags/probe_flag", {"enabled": True}),
]


@pytest_asyncio.fixture
async def platform_tokens(db_session, client) -> dict[str, str]:
    """Provision an `admin` role WITH `platform:admin` plus a `sales` role
    without it, then log both in so their JWTs carry genuine perm claims."""
    from sqlalchemy import select

    from app.models.rbac import Permission, Role, RolePermission
    from app.models.user import User, UserProfile, UserRole, UserStatus
    from app.security import hash_password

    role_perms = {
        "admin": [
            ("platform", "admin"),
            ("audit", "read"),
            ("cms", "write"),
            ("settings", "write"),
        ],
        "sales": [("analytics", "read"), ("sales", "read")],
    }

    # Migrations pre-seed some permission rows; reuse them and only add the gaps
    # to avoid tripping the (resource, action) unique constraint.
    perm_rows: dict[tuple[str, str], Permission] = {
        (p.resource, p.action): p
        for p in (await db_session.execute(select(Permission))).scalars()
    }
    for pairs in role_perms.values():
        for resource, action in pairs:
            if (resource, action) not in perm_rows:
                perm = Permission(resource=resource, action=action)
                db_session.add(perm)
                perm_rows[(resource, action)] = perm
    await db_session.flush()

    phones = {"admin": PLATFORM_ADMIN_PHONE, "sales": PLATFORM_SALES_PHONE}
    for role_name, pairs in role_perms.items():
        role = Role(name=role_name, description=f"test {role_name}")
        db_session.add(role)
        await db_session.flush()
        for pair in pairs:
            db_session.add(RolePermission(role_id=role.id, permission_id=perm_rows[pair].id))
        user = User(
            phone=phones[role_name],
            password_hash=hash_password(STAFF_PASSWORD),
            role=UserRole(role_name),
            status=UserStatus.active,
        )
        user.profile = UserProfile(full_name=f"Test {role_name.title()}")
        db_session.add(user)
    await db_session.flush()

    tokens: dict[str, str] = {}
    for role_name, phone in phones.items():
        r = await client.post(
            "/api/v1/auth/login", json={"phone": phone, "password": STAFF_PASSWORD}
        )
        assert r.status_code == 200, r.text
        tokens[role_name] = r.json()["access_token"]
    return tokens


async def _request(client, method: str, url: str, *, headers=None, json=None):
    if method == "GET":
        return await client.get(url, headers=headers)
    return await client.put(url, headers=headers, json=json)


# --- (a) authorization -------------------------------------------------------


@pytest.mark.asyncio
async def test_customer_forbidden_on_all_endpoints(client, platform_tokens):
    customer = await signup_token(client, phone_for("platform-customer"))
    for method, url, body in PLATFORM_ENDPOINTS:
        r = await _request(client, method, url, headers=auth(customer), json=body)
        assert r.status_code == 403, f"{method} {url} -> {r.status_code} {r.text}"


@pytest.mark.asyncio
async def test_sales_forbidden_on_all_endpoints(client, platform_tokens):
    sales = platform_tokens["sales"]
    for method, url, body in PLATFORM_ENDPOINTS:
        r = await _request(client, method, url, headers=auth(sales), json=body)
        assert r.status_code == 403, f"{method} {url} -> {r.status_code} {r.text}"


@pytest.mark.asyncio
async def test_unauthenticated_rejected(client):
    r = await client.get("/api/v1/platform/status")
    assert r.status_code == 401


# --- (b) status --------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_status_shape(client, platform_tokens):
    r = await client.get("/api/v1/platform/status", headers=auth(platform_tokens["admin"]))
    assert r.status_code == 200, r.text
    body = r.json()

    assert set(body) >= {"services", "queue", "worker", "version", "git_sha"}
    assert set(body["services"]) >= {"database", "redis", "worker"}
    assert set(body["queue"]) == {"pending", "failed", "dispatched"}
    assert set(body["worker"]) >= {"last_heartbeat", "stale"}

    # DB is up in tests; queue counts are plain ints; worker is stale/down here
    # (no worker process runs in the suite) but must not error.
    assert body["services"]["database"] == "ok"
    assert all(isinstance(body["queue"][k], int) for k in body["queue"])
    assert isinstance(body["worker"]["stale"], bool)
    assert isinstance(body["version"], str)


# --- (c) audit + feature flags ----------------------------------------------


@pytest.mark.asyncio
async def test_admin_lists_audit(client, platform_tokens):
    r = await client.get("/api/v1/platform/audit", headers=auth(platform_tokens["admin"]))
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"total", "limit", "offset", "items"}
    assert isinstance(body["items"], list)


@pytest.mark.asyncio
async def test_toggle_feature_flag_persists_and_audits(client, platform_tokens):
    admin = platform_tokens["admin"]

    # Enable.
    r = await client.put(
        "/api/v1/platform/feature-flags/express_checkout",
        headers=auth(admin),
        json={"enabled": True},
    )
    assert r.status_code == 200, r.text
    assert r.json()["key"] == "express_checkout"
    assert r.json()["enabled"] is True

    # Persisted + listed.
    r = await client.get("/api/v1/platform/feature-flags", headers=auth(admin))
    assert r.status_code == 200, r.text
    flags = {f["key"]: f["enabled"] for f in r.json()}
    assert flags.get("express_checkout") is True

    # Toggle back off — still persists.
    r = await client.put(
        "/api/v1/platform/feature-flags/express_checkout",
        headers=auth(admin),
        json={"enabled": False},
    )
    assert r.status_code == 200, r.text
    assert r.json()["enabled"] is False

    # An audit row was written attributing the change to the admin.
    r = await client.get(
        "/api/v1/platform/audit",
        headers=auth(admin),
        params={"action": "feature_flag", "entity_type": "feature_flag"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1
    entry = next(i for i in body["items"] if i["entity_id"] == "express_checkout")
    assert "feature_flag" in entry["action"]
    assert entry["actor_phone"] == PLATFORM_ADMIN_PHONE
    assert entry["actor_user_id"] is not None


# --- (d) integrations --------------------------------------------------------


@pytest.mark.asyncio
async def test_integrations_booleans_no_secrets(client, platform_tokens):
    r = await client.get(
        "/api/v1/platform/integrations", headers=auth(platform_tokens["admin"])
    )
    assert r.status_code == 200, r.text
    items = r.json()

    names = {i["name"] for i in items}
    assert {"sms", "storage", "razorpay", "payment_methods"} <= names
    for item in items:
        assert isinstance(item["configured"], bool)

    # No credential values must ever appear in the response. The test JWT secret
    # is the one non-empty secret in the suite's env; the integration schema only
    # exposes name/configured/detail, never a "*_secret" field.
    raw = r.text
    assert "test-secret-please-do-not-use-in-prod-32-chars" not in raw
    assert "secret" not in raw.lower()
    # sms is the console stub in tests: not "configured", provider name exposed.
    sms = next(i for i in items if i["name"] == "sms")
    assert sms["configured"] is False
    assert sms["detail"] == "console"
