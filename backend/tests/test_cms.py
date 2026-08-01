"""CMS pages/blocks, settings, feature flags."""
from __future__ import annotations

import pytest

from .conftest import STAFF_PASSWORD, STAFF_PHONES, auth, phone_for, signup_token


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
    # Use a slug the 0020 seed migration does not create (home/about/global),
    # so this CRUD flow never collides with the seeded content.
    page = await client.post(
        "/api/v1/admin/cms/pages", headers=auth(admin), json={"slug": "specials", "title": "Specials"}
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
    pub = await client.get("/api/v1/cms/pages/specials")
    assert pub.status_code == 200
    kinds = [b["kind"] for b in pub.json()["blocks"]]
    assert kinds == ["hero_slide"]

    # Activate block 2 → appears, ordered.
    await client.patch(f"/api/v1/admin/cms/blocks/{block2_id}", headers=auth(admin), json={"is_active": True})
    pub = await client.get("/api/v1/cms/pages/specials")
    assert [b["kind"] for b in pub.json()["blocks"]] == ["hero_slide", "promo"]

    # Unpublish page → public 404, admin still sees it.
    await client.patch(f"/api/v1/admin/cms/pages/{page_id}", headers=auth(admin), json={"is_published": False})
    assert (await client.get("/api/v1/cms/pages/specials")).status_code == 404
    pages = await client.get("/api/v1/admin/cms/pages", headers=auth(admin))
    slugs = [p["slug"] for p in pages.json()]
    assert "specials" in slugs


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


def test_manager_role_grants_cms_write():
    """Task 1: the production RBAC seed gives manager cms:write."""
    from scripts.rbac_data import ROLE_PERMISSIONS

    assert ("cms", "write") in ROLE_PERMISSIONS["manager"]
    assert ("cms", "write") in ROLE_PERMISSIONS["admin"]


@pytest.mark.asyncio
async def test_manager_can_write_cms_blocks(client, staff_tokens):
    """Manager holds cms:write (rbac_data grant) so both admin AND manager can
    edit storefront content."""
    admin = staff_tokens["admin"]
    page = await client.post(
        "/api/v1/admin/cms/pages", headers=auth(admin), json={"slug": "manager-test", "title": "Manager Test"}
    )
    assert page.status_code == 201, page.text
    page_id = page.json()["id"]

    created = await client.post(
        f"/api/v1/admin/cms/pages/{page_id}/blocks",
        headers=auth(staff_tokens["manager"]),
        json={"kind": "hero_slide", "content": {"title": "x"}},
    )
    assert created.status_code == 201, created.text

    # A role without cms:write (sales) is still refused.
    denied = await client.post(
        f"/api/v1/admin/cms/pages/{page_id}/blocks",
        headers=auth(staff_tokens["sales"]),
        json={"kind": "hero_slide", "content": {"title": "y"}},
    )
    assert denied.status_code == 403, denied.text


@pytest.mark.asyncio
async def test_seeded_home_page_public_read(client):
    """The 0020 seed migration publishes home with hero/trust/faq blocks, sorted."""
    r = await client.get("/api/v1/cms/pages/home")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["slug"] == "home"
    assert body["is_published"] is True

    blocks = body["blocks"]
    kinds = [b["kind"] for b in blocks]
    assert kinds.count("hero_slide") == 3
    assert kinds.count("trust_badge") == 4
    assert kinds.count("faq_item") == 5

    # Blocks come back in sort_order: the three hero slides lead the page.
    orders = [b["sort_order"] for b in blocks]
    assert orders == sorted(orders)
    assert kinds[:3] == ["hero_slide", "hero_slide", "hero_slide"]

    # Content copied verbatim from HeroCarousel.tsx / page.tsx.
    hero = blocks[0]["content"]
    assert hero["eyebrow"] == "Serviceable pincodes"
    assert hero["cta_href"] == "/products"
    assert hero["theme"] == "olive"
    faqs = [b["content"] for b in blocks if b["kind"] == "faq_item"]
    assert faqs[0]["question"] == "Who can buy on Nethrasap?"


@pytest.mark.asyncio
async def test_cms_upload_presign(client, staff_tokens):
    """Upload endpoint presigns for a valid image type, rejects a bad one."""
    admin = staff_tokens["admin"]

    ok = await client.post(
        "/api/v1/admin/cms/uploads", headers=auth(admin), json={"content_type": "image/png"}
    )
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert body["upload_url"]
    assert body["public_url"]

    bad = await client.post(
        "/api/v1/admin/cms/uploads", headers=auth(admin), json={"content_type": "application/zip"}
    )
    assert 400 <= bad.status_code < 500, bad.text

    # Gated on cms:write — a plain customer is refused.
    customer = await signup_token(client, phone_for("cms-upload-customer"))
    denied = await client.post(
        "/api/v1/admin/cms/uploads", headers=auth(customer), json={"content_type": "image/png"}
    )
    assert denied.status_code == 403, denied.text
