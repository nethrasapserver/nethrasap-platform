"""Admin catalogue CRUD + CSV import — permission gates, storefront visibility."""
from __future__ import annotations

import io

import pytest

from .conftest import auth, phone_for, signup_token


async def _create_category(client, token: str, slug: str = "generics") -> dict:
    r = await client.post(
        "/api/v1/admin/categories",
        headers=auth(token),
        json={"name": "Generics", "slug": slug, "sku_prefix": "GEN"},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _create_product(client, token: str, *, name: str = "Atorvastatin 10mg") -> dict:
    r = await client.post(
        "/api/v1/admin/products",
        headers=auth(token),
        json={"name": name, "brand": "Cipla", "category_slug": "generics", "schedule": "H"},
    )
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.asyncio
async def test_admin_routes_require_permission(client, staff_tokens):
    customer = await signup_token(client, phone_for("cat-customer"))
    r = await client.post(
        "/api/v1/admin/products",
        headers=auth(customer),
        json={"name": "X", "brand": "Y", "category_slug": "nope"},
    )
    assert r.status_code == 403
    # sales has KYC perms but not catalogue:write
    r = await client.post(
        "/api/v1/admin/categories",
        headers=auth(staff_tokens["sales"]),
        json={"name": "Nope", "sku_prefix": "NO"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_product_lifecycle_reflects_on_storefront(client, staff_tokens):
    admin = staff_tokens["admin"]
    await _create_category(client, admin)
    product = await _create_product(client, admin)
    assert product["slug"] == "atorvastatin-10mg"

    # Add a variant with role-tier prices.
    r = await client.post(
        f"/api/v1/admin/products/{product['id']}/variants",
        headers=auth(admin),
        json={
            "pack_size": "15 tabs",
            "unit_label": "strip of 15",
            "is_default": True,
            "prices": [
                {"role": "customer", "mrp": 12000, "selling_price": 11000},
                {"role": "retailer", "mrp": 12000, "selling_price": 9000},
            ],
        },
    )
    assert r.status_code == 201, r.text
    variant = r.json()["variants"][0]
    assert {p["role"]: p["selling_price"] for p in variant["prices"]} == {
        "customer": 11000,
        "retailer": 9000,
    }

    # Storefront sees it live.
    pub = await client.get("/api/v1/products?q=atorvastatin")
    assert pub.json()["total"] == 1
    assert pub.json()["items"][0]["price_min"] == 11000  # anonymous → customer tier

    # Reprice: old row closes, new price wins.
    r = await client.patch(
        f"/api/v1/admin/variants/{variant['id']}",
        headers=auth(admin),
        json={"prices": [{"role": "customer", "mrp": 12000, "selling_price": 10500}]},
    )
    assert r.status_code == 200, r.text
    pub = await client.get("/api/v1/products?q=atorvastatin")
    assert pub.json()["items"][0]["price_min"] == 10500

    # Unpublish → gone from the storefront; publish → back.
    await client.post(f"/api/v1/admin/products/{product['id']}/unpublish", headers=auth(admin))
    assert (await client.get("/api/v1/products?q=atorvastatin")).json()["total"] == 0
    await client.post(f"/api/v1/admin/products/{product['id']}/publish", headers=auth(admin))
    assert (await client.get("/api/v1/products?q=atorvastatin")).json()["total"] == 1


@pytest.mark.asyncio
async def test_duplicate_slug_conflicts(client, staff_tokens):
    admin = staff_tokens["admin"]
    await _create_category(client, admin)
    await _create_product(client, admin)
    r = await client.post(
        "/api/v1/admin/products",
        headers=auth(admin),
        json={
            "name": "Atorvastatin 10mg",
            "slug": "atorvastatin-10mg",
            "brand": "Sun",
            "category_slug": "generics",
        },
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_image_slot_and_delete(client, staff_tokens):
    admin = staff_tokens["admin"]
    await _create_category(client, admin)
    product = await _create_product(client, admin)
    r = await client.post(
        f"/api/v1/admin/products/{product['id']}/images",
        headers=auth(admin),
        json={"content_type": "image/webp", "alt": "pack shot", "is_primary": True},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["storage_key"].startswith("products/")
    assert body["upload_url"] and body["public_url"]

    d = await client.delete(f"/api/v1/admin/images/{body['image_id']}", headers=auth(admin))
    assert d.status_code == 204


@pytest.mark.asyncio
async def test_category_delete_guard(client, staff_tokens):
    admin = staff_tokens["admin"]
    cat = await _create_category(client, admin)
    await _create_product(client, admin)
    r = await client.delete(f"/api/v1/admin/categories/{cat['id']}", headers=auth(admin))
    assert r.status_code == 409  # has products


@pytest.mark.asyncio
async def test_coupon_crud(client, staff_tokens):
    admin = staff_tokens["admin"]
    r = await client.post(
        "/api/v1/admin/coupons",
        headers=auth(admin),
        json={"code": "LAUNCH20", "type": "percent", "value": 20, "min_order": 50000},
    )
    assert r.status_code == 201, r.text
    coupon = r.json()
    r = await client.patch(
        f"/api/v1/admin/coupons/{coupon['id']}", headers=auth(admin), json={"is_active": False}
    )
    assert r.json()["is_active"] is False
    r = await client.post(
        "/api/v1/admin/coupons",
        headers=auth(admin),
        json={"code": "LAUNCH20", "type": "flat", "value": 5000},
    )
    assert r.status_code == 409


CSV = """name,brand,category_slug,schedule,pack_size,unit_label,mrp_paise,price_customer_paise,price_retailer_paise
Metformin 500mg,Sun Pharma,generics,NONE,20 tabs,strip of 20,4000,3600,3000
Metformin 500mg,Sun Pharma,generics,NONE,60 tabs,bottle of 60,10000,9200,7800
Telmisartan 40mg,Cipla,generics,H,15 tabs,strip of 15,9000,8500,
Broken Row,NoBrand,missing-category,NONE,10 tabs,strip,100,90,
"""


@pytest.mark.asyncio
async def test_csv_import(client, staff_tokens):
    admin = staff_tokens["admin"]
    await _create_category(client, admin)
    r = await client.post(
        "/api/v1/admin/imports/catalogue",
        headers=auth(admin),
        files={"file": ("catalogue.csv", io.BytesIO(CSV.encode()), "text/csv")},
    )
    assert r.status_code == 200, r.text
    report = r.json()
    assert report["total_rows"] == 4
    assert report["products_created"] == 2
    assert report["variants_created"] == 3
    assert report["prices_set"] == 5  # 2+2 metformin rows(2 roles each? -> 2+2) + telmisartan 1
    assert len(report["errors"]) == 1 and report["errors"][0]["row"] == 5

    pub = await client.get("/api/v1/products?q=metformin")
    assert pub.json()["total"] == 1
    assert pub.json()["items"][0]["price_min"] == 3600  # cheapest variant, customer tier
