"""Dev seed — RBAC roles/permissions + a realistic pharma catalogue.

Self-contained (no seed_data.json). Idempotent by natural key. Run:

    cd backend && uv run python -m scripts.seed_dev

Gives the storefront real products to render and the dashboard real staff
logins. Catalogue prices are role-tiered; every variant gets opening stock.
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from app.db import SessionLocal
from app.logging import configure_logging, get_logger
from app.models.catalogue import (
    Category,
    PriceRole,
    Product,
    ProductImage,
    ProductPrice,
    ProductVariant,
    ScheduleClass,
    StockStatus,
)
from app.models.inventory import StockLedger, StockLevel, StockMovement, Warehouse
from app.security import hash_password

# Import the RBAC + demo-user seeding from the main seed module (no JSON needed).
from scripts.seed import (
    DEMO_PASSWORD,
    DEMO_USERS,
    seed_roles_and_permissions,
)
from sqlalchemy import select

configure_logging("dev")
log = get_logger("scripts.seed_dev")

CATEGORIES = [
    ("prescription", "Prescription (Rx)", "RX", "Schedule H / H1 medicines"),
    ("otc", "Over the Counter", "OTC", "Everyday relief, no prescription"),
    ("devices", "Devices & Diagnostics", "DEV", "Monitors, kits, surgical"),
    ("wellness", "Wellness & Nutrition", "WEL", "Supplements and daily health"),
    ("cold-chain", "Cold Chain", "CC", "Vaccines and biologics (2-8C)"),
    ("surgical", "Surgical & Consumables", "SUR", "Gloves, dressings, disposables"),
    ("baby-care", "Baby & Mother Care", "BAB", "Infant nutrition and care"),
    ("ayurveda", "Ayurveda & Herbal", "AYU", "Classical and proprietary formulations"),
]

# (slug, name, brand, category, schedule, hsn, featured, packs[(size, label, cust, clin, ret)])
PRODUCTS = [
    ("amoxicillin-500mg", "Amoxicillin 500mg Capsules", "Cipla", "prescription", "H", "3004", True,
     [("10x10 strip", "Strip of 10", 8500, 7800, 6900), ("Box of 100", "Box of 100", 78000, 71000, 62000)]),
    ("azithromycin-500mg", "Azithromycin 500mg Tablets", "Sun Pharma", "prescription", "H", "3004", True,
     [("3 tablets", "Strip of 3", 6500, 6000, 5300)]),
    ("insulin-glargine", "Insulin Glargine 100IU/ml", "Biocon", "cold-chain", "H", "3004", True,
     [("3ml cartridge", "Cartridge 3ml", 42000, 39000, 35000)]),
    ("paracetamol-650mg", "Paracetamol 650mg Tablets", "GSK", "otc", "NONE", "3004", False,
     [("15 tablets", "Strip of 15", 3000, 2800, 2500)]),
    ("ors-powder", "ORS Powder Sachet (Orange)", "FDC", "otc", "NONE", "3004", False,
     [("21g sachet", "Sachet 21g", 2200, 2000, 1800), ("Box of 30", "Box of 30", 60000, 55000, 49000)]),
    ("omron-bp-monitor", "Omron HEM-7120 BP Monitor", "Omron", "devices", "NONE", "9018", True,
     [("1 unit", "Single unit", 189000, 179000, 165000)]),
    ("digital-thermometer", "Digital Thermometer", "Dr Trust", "devices", "NONE", "9025", False,
     [("1 unit", "Single unit", 24900, 22900, 19900)]),
    ("vitamin-d3-60k", "Vitamin D3 60000 IU Sachet", "Mankind", "wellness", "NONE", "2936", False,
     [("4 sachets", "Strip of 4", 9900, 9200, 8300)]),
    ("multivitamin-tabs", "Daily Multivitamin Tablets", "HealthKart", "wellness", "NONE", "2936", True,
     [("30 tablets", "Bottle of 30", 34900, 32000, 28500)]),
    ("covishield-vial", "Recombinant Hepatitis-B Vaccine", "Serum Institute", "cold-chain", "H", "3002", False,
     [("0.5ml vial", "Single vial", 25000, 23000, 20500)]),
    ("pantoprazole-40mg", "Pantoprazole 40mg Tablets", "Alkem", "prescription", "H", "3004", True,
     [("15 tablets", "Strip of 15", 12500, 11500, 10200)]),
    ("metformin-500mg", "Metformin 500mg Tablets", "USV", "prescription", "H", "3004", True,
     [("20 tablets", "Strip of 20", 4400, 4000, 3600)]),
    ("cetirizine-10mg", "Cetirizine 10mg Tablets", "Dr Reddy's", "otc", "NONE", "3004", False,
     [("10 tablets", "Strip of 10", 2400, 2200, 1950)]),
    ("nitrile-gloves", "Nitrile Examination Gloves (M)", "Romsons", "surgical", "NONE", "4015", True,
     [("Box of 100", "Box of 100", 68000, 62000, 55000)]),
    ("cotton-crepe-bandage", "Cotton Crepe Bandage 10cm", "Datt Mediproducts", "surgical", "NONE", "3005", False,
     [("1 roll", "Single roll", 9500, 8700, 7800)]),
    ("infant-formula-stage1", "Infant Formula Stage 1 (400g)", "Nestle", "baby-care", "NONE", "1901", True,
     [("400g tin", "Tin of 400g", 52000, 48000, 43000)]),
    ("baby-diapers-m", "Baby Diapers Medium (Pack of 46)", "Pampers", "baby-care", "NONE", "9619", False,
     [("Pack of 46", "Pack of 46", 84900, 78000, 70000)]),
    ("ashwagandha-tabs", "Ashwagandha 500mg Tablets", "Himalaya", "ayurveda", "NONE", "3004", True,
     [("60 tablets", "Bottle of 60", 32000, 29500, 26500)]),
    ("chyawanprash-1kg", "Chyawanprash Immunity Formula 1kg", "Dabur", "ayurveda", "NONE", "2106", False,
     [("1kg jar", "Jar of 1kg", 41500, 38000, 34000)]),
    ("glucometer-strips", "Glucometer Test Strips (Pack of 50)", "Accu-Chek", "devices", "NONE", "3822", True,
     [("Pack of 50", "Pack of 50", 96000, 89000, 80000)]),
]


async def _get_or_create_category(db, slug, name, prefix, desc, idx):
    existing = (await db.execute(select(Category).where(Category.slug == slug))).scalar_one_or_none()
    if existing:
        return existing
    cat = Category(slug=slug, name=name, sku_prefix=prefix, description=desc, sort_order=idx)
    db.add(cat)
    await db.flush()
    return cat


async def seed_catalogue(db) -> None:
    cats = {}
    for i, (slug, name, prefix, desc) in enumerate(CATEGORIES):
        cats[slug] = await _get_or_create_category(db, slug, name, prefix, desc, i)

    warehouse = (await db.execute(select(Warehouse).where(Warehouse.code == "MAIN"))).scalar_one_or_none()
    if warehouse is None:
        warehouse = Warehouse(code="MAIN", name="Main Warehouse", city="Chennai", state="Tamil Nadu")
        db.add(warehouse)
        await db.flush()

    now = datetime.now(UTC)
    created = 0
    for slug, name, brand, cat_slug, schedule, hsn, featured, packs in PRODUCTS:
        if (await db.execute(select(Product.id).where(Product.slug == slug))).scalar_one_or_none():
            continue
        # `brand` was dropped as a column in migration 0017; keep it as the
        # manufacturer attribute the PDP renders.
        product = Product(
            slug=slug, name=name, category_id=cats[cat_slug].id,
            description=f"{name} by {brand}. Sourced through Nethrasap's audited cold-chain and GDP-compliant supply.",
            schedule=ScheduleClass(schedule), hsn_code=hsn, is_featured=featured,
            stock_status=StockStatus.in_stock, gst_rate_pct=12,
            attributes={"manufacturer": brand},
        )
        db.add(product)
        await db.flush()
        for j, (size, label, cust, clin, ret) in enumerate(packs):
            variant = ProductVariant(
                product_id=product.id, pack_size=size, unit_label=label,
                is_default=(j == 0), sort_order=j,
            )
            db.add(variant)
            await db.flush()
            for role, price in ((PriceRole.customer, cust), (PriceRole.clinician, clin), (PriceRole.retailer, ret)):
                db.add(ProductPrice(
                    variant_id=variant.id, role=role, mrp=cust, selling_price=price,
                    currency="INR", valid_from=now,
                ))
            # Opening stock: 200 units per variant.
            db.add(StockLevel(variant_id=variant.id, warehouse_id=warehouse.id, on_hand=200, reserved=0, reorder_point=20))
            db.add(StockLedger(
                variant_id=variant.id, warehouse_id=warehouse.id, movement=StockMovement.receipt,
                quantity=200, reason="opening stock",
            ))
        # Placeholder image (Unsplash medical); real images upload via admin later.
        db.add(ProductImage(
            product_id=product.id,
            storage_key=f"https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80&sig={slug}",
            alt=name, is_primary=True, sort_order=0,
        ))
        created += 1
    log.info("seed_dev.catalogue", created=created, categories=len(cats))


async def main() -> None:
    async with SessionLocal() as db:
        await seed_roles_and_permissions(db)
        # Demo staff/customer logins (phone + DEMO_PASSWORD).
        from app.models.user import User, UserProfile
        for phone, role, full_name, status in DEMO_USERS:
            if (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none():
                continue
            u = User(phone=phone, phone_verified_at=datetime.now(UTC),
                     password_hash=hash_password(DEMO_PASSWORD), role=role, status=status)
            u.profile = UserProfile(full_name=full_name)
            db.add(u)
        await db.commit()
        await seed_catalogue(db)
        await db.commit()
    log.info("seed_dev.done", password=DEMO_PASSWORD)


if __name__ == "__main__":
    asyncio.run(main())
