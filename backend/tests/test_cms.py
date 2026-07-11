"""CMS pages/blocks, settings, feature flags."""
from __future__ import annotations

import pytest

from .conftest import auth, phone_for, signup_token


@pytest.mark.asyncio
async def test_cms_requires_permission(client, staff_tokens):
    customer = await signup_token(client, phone_for("cms-customer"))
    r = await client.post(
        "/api/v1/admin/cms/pages", headers=auth(customer), json={"slug": "home", "title": "Home"}
    )
    assert r.status_code == 403
    r = await client.post(
        "/api/v1/admin/cms/pages", headers=auth(staff_tokens["sales"]), json={"slug": "home", "title": "Home"}
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_page_blocks_and_public_read(client, staff_tokens):
    admin = staff_tokens["admin"]
    page = await client.post(
        "/api/v1/admin/cms/pages", headers=auth(admin), json={"slug": "home", "title": "Home"}
    )
    assert page.status_code == 201, page.text
    page_id = page.json()["id"]

    b1 = await client.post(
        f"/api/v1/admin/cms/pages/{page_id}/blocks",
        headers=auth(admin),
        json={"kind": "hero_slide", "sort_order": 0, "content": {"title": "Audited supply", "cta": "/products"}},
    )
    assert b1.status_code == 201
    b2 = await client.post(
        f"/api/v1/admin/cms/pages/{page_id}/blocks",
        headers=auth(admin),
        json={"kind": "promo", "sort_order": 1, "is_active": False, "content": {"text": "hidden"}},
    )
    block2_id = b2.json()["blocks"][1]["id"]

    # Public read: only active blocks.
    pub = await client.get("/api/v1/cms/pages/home")
    assert pub.status_code == 200
    kinds = [b["kind"] for b in pub.json()["blocks"]]
    assert kinds == ["hero_slide"]

    # Activate block 2 → appears, ordered.
    await client.patch(f"/api/v1/admin/cms/blocks/{block2_id}", headers=auth(admin), json={"is_active": True})
    pub = await client.get("/api/v1/cms/pages/home")
    assert [b["kind"] for b in pub.json()["blocks"]] == ["hero_slide", "promo"]

    # Unpublish page → public 404, admin still sees it.
    await client.patch(f"/api/v1/admin/cms/pages/{page_id}", headers=auth(admin), json={"is_published": False})
    assert (await client.get("/api/v1/cms/pages/home")).status_code == 404
    pages = await client.get("/api/v1/admin/cms/pages", headers=auth(admin))
    assert pages.json()[0]["slug"] == "home"


@pytest.mark.asyncio
async def test_settings_roundtrip(client, staff_tokens):
    admin = staff_tokens["admin"]
    r = await client.put(
        "/api/v1/admin/settings",
        headers=auth(admin),
        json={"values": {"support_phone": "+911800123456", "free_shipping_min_paise": 50000}},
    )
    assert r.status_code == 200, r.text
    r = await client.put(
        "/api/v1/admin/settings", headers=auth(admin), json={"values": {"free_shipping_min_paise": 60000}}
    )
    body = r.json()
    assert body["free_shipping_min_paise"] == 60000
    assert body["support_phone"] == "+911800123456"


@pytest.mark.asyncio
async def test_feature_flags(client, staff_tokens):
    admin = staff_tokens["admin"]
    r = await client.put(
        "/api/v1/admin/flags",
        headers=auth(admin),
        json={"key": "chat_widget", "enabled": True, "description": "storefront chat"},
    )
    assert r.status_code == 200, r.text
    # Public flags endpoint — no auth needed.
    flags = await client.get("/api/v1/flags")
    assert flags.json()["chat_widget"] is True

    await client.put("/api/v1/admin/flags", headers=auth(admin), json={"key": "chat_widget", "enabled": False})
    assert (await client.get("/api/v1/flags")).json()["chat_widget"] is False
