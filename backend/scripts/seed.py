"""Seed the database with categories, products, RBAC roles, and demo users.

Run from `backend/` after `alembic upgrade head`:

    uv run python -m scripts.seed

The script is idempotent — every row is upserted by its natural key (slug for
categories/products, phone for users, name for roles, etc.). Safe to re-run.
"""
from __future__ import annotations

import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.config import get_settings
from app.db import SessionLocal
from app.logging import configure_logging, get_logger
from app.models.cart import Coupon, CouponType
from app.models.catalogue import (
    Category,
    PriceRole,
    Product,
    ProductImage,
    ProductPrice,
    ProductVariant,
    Review,
    ScheduleClass,
    StockStatus,
)
from app.models.order import (
    Invoice,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    Payment,
    PaymentMethod,
    PaymentStatus,
    Shipment,
    ShipmentStatus,
)
from app.models.rbac import Permission, Role, RolePermission
from app.models.user import User, UserProfile, UserRole, UserStatus
from app.security import hash_password
from app.services.pricing import compute_line
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

BACKEND_ROOT = Path(__file__).resolve().parents[1]
SEED_JSON = BACKEND_ROOT / "scripts" / "seed_data.json"

configure_logging("dev")
log = get_logger("scripts.seed")
settings = get_settings()

DEMO_PASSWORD = "Demo123!"  # local-only seed password — clearly insecure

# ---------------------------------------------------------------------------
# Role-aware pricing — Phase 1 derives 3 tiers from data.js's flat price_min.
# Replace with real admin-managed prices once the pricing UI lands.
# ---------------------------------------------------------------------------
PRICE_RATIOS: dict[PriceRole, float] = {
    PriceRole.customer: 1.0,
    PriceRole.clinician: 0.92,
    PriceRole.retailer: 0.85,
}


# ---------------------------------------------------------------------------
# Roles + permissions seed
# ---------------------------------------------------------------------------
ROLE_DEFS: list[dict] = [
    {"name": "customer", "description": "Walk-in/online customer — MRP pricing"},
    {"name": "clinician", "description": "Verified clinician — institutional pricing"},
    {"name": "retailer", "description": "Verified retailer — wholesale pricing"},
    {"name": "sales", "description": "Sales rep — manages assigned accounts"},
    {"name": "manager", "description": "Sales manager — supervises sales team"},
    {"name": "admin", "description": "Platform admin — full access"},
]

PERMISSION_DEFS: list[dict] = [
    # storefront
    {"resource": "products", "action": "read", "description": "Read public catalogue"},
    {"resource": "products", "action": "create"},
    {"resource": "products", "action": "update"},
    {"resource": "products", "action": "delete"},
    {"resource": "orders", "action": "read_own"},
    {"resource": "orders", "action": "read_assigned"},
    {"resource": "orders", "action": "read_all"},
    {"resource": "orders", "action": "create"},
    {"resource": "orders", "action": "refund"},
    {"resource": "orders", "action": "fulfil"},
    # users
    {"resource": "users", "action": "read"},
    {"resource": "users", "action": "update_role"},
    {"resource": "users", "action": "suspend"},
    # kyc
    {"resource": "kyc", "action": "review"},
    {"resource": "kyc", "action": "approve"},
    {"resource": "kyc", "action": "reject"},
    # admin surfaces
    {"resource": "catalogue", "action": "write"},
    {"resource": "inventory", "action": "write"},
    {"resource": "cms", "action": "write"},
    {"resource": "settings", "action": "write"},
    {"resource": "enquiries", "action": "manage"},
    {"resource": "chat", "action": "manage"},
    {"resource": "analytics", "action": "read"},
    {"resource": "sales", "action": "read"},
    {"resource": "sales", "action": "manage"},
    {"resource": "audit", "action": "read"},
    {"resource": "hr", "action": "manage"},
]

ROLE_PERMISSIONS: dict[str, list[tuple[str, str]]] = {
    "customer": [("products", "read"), ("orders", "create"), ("orders", "read_own")],
    "clinician": [("products", "read"), ("orders", "create"), ("orders", "read_own")],
    "retailer": [("products", "read"), ("orders", "create"), ("orders", "read_own")],
    "sales": [
        ("products", "read"),
        ("orders", "read_assigned"),
        ("orders", "fulfil"),
        ("kyc", "review"),
        ("kyc", "approve"),
        ("kyc", "reject"),
        ("enquiries", "manage"),
        ("chat", "manage"),
        ("analytics", "read"),
        ("sales", "read"),
    ],
    "manager": [
        ("products", "read"),
        ("orders", "read_assigned"),
        ("orders", "read_all"),
        ("orders", "fulfil"),
        ("kyc", "review"),
        ("kyc", "approve"),
        ("kyc", "reject"),
        ("users", "read"),
        ("enquiries", "manage"),
        ("chat", "manage"),
        ("analytics", "read"),
        ("sales", "read"),
        ("sales", "manage"),
        ("audit", "read"),
        ("hr", "manage"),
    ],
    "admin": [(p["resource"], p["action"]) for p in PERMISSION_DEFS],
}

# Dev-only fixtures — phone-first identity (the platform has no email).
DEMO_USERS = [
    ("+919800000001", UserRole.customer, "Priya Iyer", UserStatus.active),
    ("+919800000002", UserRole.clinician, "Dr. Arjun Mehta", UserStatus.active),
    ("+919800000003", UserRole.retailer, "Asha Pharmacy", UserStatus.active),
    ("+919800000004", UserRole.sales, "Ravi Kumar", UserStatus.active),
    ("+919800000005", UserRole.manager, "Neha Verma", UserStatus.active),
    ("+919800000006", UserRole.admin, "Platform Admin", UserStatus.active),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _category_glyph_lookup() -> dict[str, str]:
    """Map data.js category.glyph (icon names) — useful when the seed reseeds."""
    return {
        "prescription": "Pill",
        "otc": "Apple",
        "cardio": "Stethoscope",
        "surgical": "Syringe",
        "diagnostics": "Beaker",
        "maternal-child": "Baby",
        "cold-chain": "Snowflake",
        "wellness": "Sparkle",
    }


def _normalise_schedule(value: Any) -> ScheduleClass:
    if not value:
        return ScheduleClass.NONE
    value = str(value).upper()
    try:
        return ScheduleClass(value)
    except ValueError:
        return ScheduleClass.NONE


def _normalise_stock(value: Any) -> StockStatus:
    if not value:
        return StockStatus.in_stock
    try:
        return StockStatus(str(value))
    except ValueError:
        return StockStatus.in_stock


# ---------------------------------------------------------------------------
# Seed steps
# ---------------------------------------------------------------------------
async def seed_roles_and_permissions(db) -> None:
    # Upsert permissions
    perm_lookup: dict[tuple[str, str], Permission] = {}
    for p in PERMISSION_DEFS:
        existing = (
            await db.execute(
                select(Permission).where(
                    Permission.resource == p["resource"], Permission.action == p["action"]
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            existing = Permission(
                resource=p["resource"],
                action=p["action"],
                description=p.get("description"),
            )
            db.add(existing)
            await db.flush()
        perm_lookup[(p["resource"], p["action"])] = existing

    # Upsert roles
    role_lookup: dict[str, Role] = {}
    for r in ROLE_DEFS:
        existing = (
            await db.execute(select(Role).where(Role.name == r["name"]))
        ).scalar_one_or_none()
        if existing is None:
            existing = Role(name=r["name"], description=r["description"])
            db.add(existing)
            await db.flush()
        role_lookup[r["name"]] = existing

    # Wire role→permission
    for role_name, perms in ROLE_PERMISSIONS.items():
        role = role_lookup[role_name]
        for resource, action in perms:
            perm = perm_lookup[(resource, action)]
            existing = (
                await db.execute(
                    select(RolePermission).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == perm.id,
                    )
                )
            ).scalar_one_or_none()
            if existing is None:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    log.info(
        "seed.roles",
        roles=len(ROLE_DEFS),
        permissions=len(PERMISSION_DEFS),
    )


async def seed_demo_users(db) -> None:
    created = 0
    for phone, role, full_name, status in DEMO_USERS:
        existing = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
        if existing is not None:
            continue
        user = User(
            phone=phone,
            phone_verified_at=datetime.now(UTC),
            password_hash=hash_password(DEMO_PASSWORD),
            role=role,
            status=status,
        )
        user.profile = UserProfile(full_name=full_name)
        db.add(user)
        created += 1
    log.info("seed.users", created=created, password=DEMO_PASSWORD)


async def seed_categories(db, categories: list[dict]) -> dict[str, Category]:
    lookup: dict[str, Category] = {}
    glyphs = _category_glyph_lookup()
    for idx, c in enumerate(categories):
        slug = c["slug"]
        existing = (
            await db.execute(select(Category).where(Category.slug == slug))
        ).scalar_one_or_none()
        payload = dict(
            slug=slug,
            name=c["name"],
            description=c.get("description"),
            sku_prefix=c["sku"],
            glyph=glyphs.get(slug, c.get("glyph")),
            sort_order=idx,
            is_active=True,
        )
        if existing is None:
            existing = Category(**payload)
            db.add(existing)
            await db.flush()
        else:
            for k, v in payload.items():
                setattr(existing, k, v)
        lookup[slug] = existing
    log.info("seed.categories", count=len(lookup))
    return lookup


async def seed_products(db, products: list[dict], cat_lookup: dict[str, Category]) -> None:
    now = datetime.now(UTC)
    created = 0
    for p in products:
        slug = p["slug"]
        cat = cat_lookup.get(p["category_slug"])
        if cat is None:
            log.warning("seed.product.skip_no_category", slug=slug, cat=p.get("category_slug"))
            continue

        existing = (
            await db.execute(
                select(Product).where(Product.slug == slug)
            )
        ).scalar_one_or_none()

        prod_kwargs = dict(
            slug=slug,
            name=p["name"],
            brand=p["brand"],
            description=p.get("description"),
            category_id=cat.id,
            sub_category=p.get("sub_category") or p.get("sub"),
            schedule=_normalise_schedule(p.get("schedule")),
            hsn_code=p.get("hsn_code"),
            stock_status=_normalise_stock(p.get("stock_status") or p.get("stock")),
            is_active=True,
            is_featured=bool(p.get("is_featured") or p.get("featured")),
            badge=p.get("badge"),
            delivery_time_mins=p.get("delivery_time_mins") or p.get("delivery"),
            rating=float(p.get("rating") or 0),
            reviews_count=int(p.get("reviews") or 0),
            specs=p.get("specs") or [],
            attributes={
                k: v
                for k, v in p.items()
                if k
                in (
                    "manufacturer_address",
                    "batch",
                    "expiry",
                    "review_list",
                )
            },
        )

        if existing is None:
            product = Product(**prod_kwargs)
            db.add(product)
            await db.flush()
            created += 1
        else:
            product = existing
            for k, v in prod_kwargs.items():
                setattr(product, k, v)
            await db.flush()

        # Single default variant (data.js doesn't enumerate multiple pack sizes)
        variant = (
            await db.execute(
                select(ProductVariant).where(
                    ProductVariant.product_id == product.id,
                    ProductVariant.is_default.is_(True),
                )
            )
        ).scalar_one_or_none()
        if variant is None:
            variant = ProductVariant(
                product_id=product.id,
                pack_size=p.get("unit_label") or p.get("unit") or "1 unit",
                unit_label=p.get("unit_label") or p.get("unit") or "1 unit",
                is_default=True,
                sort_order=0,
            )
            db.add(variant)
            await db.flush()
        else:
            variant.unit_label = p.get("unit_label") or variant.unit_label
            variant.pack_size = p.get("unit_label") or variant.pack_size

        # Role-aware prices — derive 3 tiers from price_min (selling) and price_max (MRP)
        mrp = int(p.get("price_max") or p.get("max") or 0)
        baseline = int(p.get("price_min") or p.get("min") or 0)
        for role, ratio in PRICE_RATIOS.items():
            # Upsert the active price row (variant, role)
            existing_price = (
                await db.execute(
                    select(ProductPrice).where(
                        ProductPrice.variant_id == variant.id,
                        ProductPrice.role == role,
                        ProductPrice.valid_to.is_(None),
                    )
                )
            ).scalar_one_or_none()
            selling = max(1, int(round(baseline * ratio)))
            if existing_price is None:
                db.add(
                    ProductPrice(
                        variant_id=variant.id,
                        role=role,
                        mrp=mrp,
                        selling_price=selling,
                        currency="INR",
                        valid_from=now,
                    )
                )
            else:
                existing_price.mrp = mrp
                existing_price.selling_price = selling

        # Single placeholder image — Phase 4 introduces S3-backed uploads.
        existing_image = (
            await db.execute(
                select(ProductImage).where(
                    ProductImage.product_id == product.id,
                    ProductImage.storage_key == "placeholder.png",
                )
            )
        ).scalar_one_or_none()
        if existing_image is None:
            db.add(
                ProductImage(
                    product_id=product.id,
                    storage_key="placeholder.png",
                    alt=product.name,
                    sort_order=0,
                    is_primary=True,
                )
            )

    log.info("seed.products", count=len(products), created=created)


SEED_REVIEWS = [
    # (phone, rating, title, body)
    ("+919800000001", 5, "Reliable supply", "Always in stock, dispatch on time."),
    ("+919800000002", 4, "Good clinical fit", "Used across two pharmacies — no issues."),
    ("+919800000003", 5, "Margin works", "Volume pricing is competitive vs my distributor."),
]


async def seed_reviews(db) -> None:
    """Seed a handful of reviews against featured products. Idempotent."""
    user_lookup: dict[str, User] = {}
    for phone, *_ in SEED_REVIEWS:
        u = (
            await db.execute(select(User).where(User.phone == phone))
        ).scalar_one_or_none()
        if u:
            user_lookup[phone] = u
    if not user_lookup:
        log.warning("seed.reviews.skip_no_demo_users")
        return

    featured_stmt = select(Product).where(
        Product.is_active.is_(True), Product.is_featured.is_(True)
    )
    featured = (await db.execute(featured_stmt)).scalars().unique().all()

    created = 0
    for product in featured:
        for phone, rating, title, body in SEED_REVIEWS:
            user = user_lookup.get(phone)
            if user is None:
                continue
            existing = (
                await db.execute(
                    select(Review).where(
                        Review.user_id == user.id,
                        Review.product_id == product.id,
                    )
                )
            ).scalar_one_or_none()
            if existing is not None:
                continue
            db.add(
                Review(
                    user_id=user.id,
                    product_id=product.id,
                    rating=rating,
                    title=title,
                    body=body,
                )
            )
            created += 1
    log.info("seed.reviews", created=created, products=len(featured))


SEED_COUPONS = [
    {
        "code": "WELCOME10",
        "type": CouponType.percent,
        "value": 10,
        "min_order": 30_000,   # ₹300
        "max_uses": 5000,
        "is_active": True,
    },
    {
        "code": "FLAT50",
        "type": CouponType.flat,
        "value": 5_000,         # ₹50 off
        "min_order": 50_000,    # ₹500
        "max_uses": None,
        "is_active": True,
    },
    {
        "code": "RETAILER100",
        "type": CouponType.flat,
        "value": 10_000,        # ₹100 off
        "min_order": 100_000,   # ₹1,000
        "max_uses": None,
        "is_active": True,
    },
]


async def seed_coupons(db) -> None:
    created = 0
    for spec in SEED_COUPONS:
        existing = (
            await db.execute(select(Coupon).where(Coupon.code == spec["code"]))
        ).scalar_one_or_none()
        if existing is not None:
            continue
        db.add(Coupon(**spec))
        created += 1
    log.info("seed.coupons", created=created, total=len(SEED_COUPONS))


async def seed_sample_orders(db) -> None:
    """Insert one delivered + one in-flight order for the demo retailer."""
    retailer = (
        await db.execute(select(User).where(User.phone == "+919800000003"))
    ).scalar_one_or_none()
    if retailer is None:
        log.warning("seed.sample_orders.skip_no_retailer")
        return

    # Skip if any sample order already exists for the retailer.
    existing = (
        await db.execute(select(Order).where(Order.user_id == retailer.id).limit(1))
    ).scalar_one_or_none()
    if existing is not None:
        log.info("seed.sample_orders.skip_already_exists")
        return

    # Pick the first variant of an Amoxicillin-ish product.
    variant = (
        await db.execute(
            select(ProductVariant)
            .options(selectinload(ProductVariant.product))
            .join(Product, Product.id == ProductVariant.product_id)
            .where(Product.is_featured.is_(True))
            .order_by(Product.name)
            .limit(1)
        )
    ).scalar_one_or_none()
    if variant is None:
        log.warning("seed.sample_orders.no_featured_variant")
        return

    address = {
        "full_name": "Asha Pharmacy",
        "phone": "+91 98201 12345",
        "line1": "Shop 12, Sai Baba Marg",
        "line2": None,
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400003",
        "country": "IN",
    }

    now = datetime.now(UTC)
    seq = (await db.execute(select(func.nextval("order_number_seq")))).scalar_one()
    order_number = f"NS-{now.year}-{seq:05d}"

    qty = 2
    unit_price = 8500  # ₹85
    line = compute_line(
        quantity=qty,
        unit_price=unit_price,
        gst_rate_pct=variant.product.gst_rate_pct,
    )

    order = Order(
        order_number=order_number,
        user_id=retailer.id,
        status=OrderStatus.delivered,
        subtotal=line.subtotal,
        discount_total=0,
        gst_total=line.gst_amount,
        shipping_total=0,
        grand_total=line.line_total,
        currency="INR",
        shipping_address=address,
        payment_method=PaymentMethod.upi,
        payment_status=PaymentStatus.captured,
        client_request_id=f"seed-{order_number}",
        placed_at=now,
        confirmed_at=now,
        delivered_at=now,
    )
    db.add(order)
    await db.flush()
    db.add(
        OrderItem(
            order_id=order.id,
            variant_id=variant.id,
            product_name_snapshot=variant.product.name,
            brand_snapshot=variant.product.brand,
            unit_label_snapshot=variant.unit_label,
            hsn_code_snapshot=variant.product.hsn_code,
            quantity=qty,
            unit_price=unit_price,
            gst_rate_pct=line.gst_rate_pct,
            gst_amount=line.gst_amount,
            line_total=line.line_total,
        )
    )
    db.add(
        OrderStatusHistory(
            order_id=order.id,
            status=OrderStatus.delivered,
            actor_user_id=retailer.id,
            note="Seeded historical order — already delivered",
            at=now,
        )
    )
    db.add(
        Payment(
            order_id=order.id,
            method=PaymentMethod.upi,
            status=PaymentStatus.captured,
            amount=line.line_total,
            currency="INR",
            gateway="razorpay-stub",
            gateway_order_id=f"order_stub_seed_{seq}",
            gateway_payment_id=f"pay_stub_seed_{seq}",
            captured_at=now,
        )
    )
    db.add(
        Invoice(
            order_id=order.id,
            invoice_number=order_number,
            pdf_storage_key=None,
            issued_at=now,
        )
    )
    db.add(
        Shipment(
            order_id=order.id,
            status=ShipmentStatus.delivered,
            courier="Bluedart",
            awb_number=f"BD-{seq:09d}",
            dispatched_at=now,
            delivered_at=now,
        )
    )
    log.info("seed.sample_orders", order_number=order_number)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
async def main(force: bool = False) -> None:
    if not settings.is_dev and not force:
        raise SystemExit(
            "Refusing to seed: ENVIRONMENT is not dev. "
            "Pass --force if you really meant it."
        )

    if not SEED_JSON.exists():
        raise SystemExit(
            f"Seed JSON not found at {SEED_JSON}. "
            "Run `node frontend/scripts/dump-seed-data.mjs` first (or `make dump-seed-data`)."
        )

    data = json.loads(SEED_JSON.read_text())

    async with SessionLocal() as db:
        await seed_roles_and_permissions(db)
        await seed_demo_users(db)
        cat_lookup = await seed_categories(db, data["categories"])
        await seed_products(db, data["products"], cat_lookup)
        await db.flush()  # ensure products exist before reviews seed
        await seed_reviews(db)
        await seed_coupons(db)
        await db.flush()
        await seed_sample_orders(db)
        await db.commit()

    log.info("seed.done")


if __name__ == "__main__":
    force = "--force" in sys.argv
    asyncio.run(main(force=force))
