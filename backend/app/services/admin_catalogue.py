"""Admin catalogue management — products, variants, role-tier prices, images,
categories, coupons, and the CSV import that feeds production data in bulk.

Every mutation is audited and publishes to `topic:catalogue` so storefront
clients revalidate.
"""
from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..integrations import storage
from ..logging import get_logger
from ..models.audit import AuditLog
from ..models.cart import Coupon, CouponType
from ..models.catalogue import (
    Category,
    PriceRole,
    Product,
    ProductImage,
    ProductPrice,
    ProductVariant,
    ScheduleClass,
    StockStatus,
)
from ..models.user import User
from ..realtime import publish_event
from ..realtime.channels import topic_channel

log = get_logger("services.admin_catalogue")


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:140] or uuid.uuid4().hex[:12]


async def _audit(db: AsyncSession, actor: User, action: str, entity_type: str, entity_id: str, payload: dict) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
        )
    )


async def _catalogue_event(type: str, entity: str, entity_id: str) -> None:
    await publish_event(topic_channel("catalogue"), type=type, entity=entity, entity_id=entity_id)


async def _category_by_slug(db: AsyncSession, slug: str) -> Category:
    cat = (await db.execute(select(Category).where(Category.slug == slug))).scalar_one_or_none()
    if cat is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"unknown category: {slug}")
    return cat


async def _load_product(db: AsyncSession, product_id: uuid.UUID) -> Product:
    product = (
        await db.execute(
            select(Product)
            .options(
                selectinload(Product.variants).selectinload(ProductVariant.prices),
                selectinload(Product.images),
                selectinload(Product.category),
            )
            .where(Product.id == product_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
    return product


# --- Products ----------------------------------------------------------------


async def get_product(db: AsyncSession, product_id: uuid.UUID) -> Product:
    """Load a single product (draft or live) with variants, prices and images."""
    return await _load_product(db, product_id)


async def create_product(db: AsyncSession, actor: User, data: dict) -> Product:
    category = await _category_by_slug(db, data.pop("category_slug"))
    slug = data.pop("slug", None) or _slugify(data["name"])
    exists = (await db.execute(select(Product.id).where(Product.slug == slug))).scalar_one_or_none()
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, f"slug already exists: {slug}")

    product = Product(
        slug=slug,
        category_id=category.id,
        schedule=ScheduleClass(data.pop("schedule")),
        stock_status=StockStatus(data.pop("stock_status")),
        **data,
    )
    db.add(product)
    await db.flush()
    await _audit(db, actor, "product.created", "product", str(product.id), {"slug": slug})
    await db.commit()
    await _catalogue_event("product.created", "product", str(product.id))
    return await _load_product(db, product.id)


async def update_product(db: AsyncSession, actor: User, product_id: uuid.UUID, data: dict) -> Product:
    product = await _load_product(db, product_id)
    changes = {k: v for k, v in data.items() if v is not None}
    if "category_slug" in changes:
        product.category_id = (await _category_by_slug(db, changes.pop("category_slug"))).id
    if "schedule" in changes:
        product.schedule = ScheduleClass(changes.pop("schedule"))
    if "stock_status" in changes:
        product.stock_status = StockStatus(changes.pop("stock_status"))
    for k, v in changes.items():
        setattr(product, k, v)
    await _audit(db, actor, "product.updated", "product", str(product.id), {"fields": sorted(changes)})
    await db.commit()
    await _catalogue_event("product.updated", "product", str(product.id))
    return await _load_product(db, product_id)


async def set_product_active(db: AsyncSession, actor: User, product_id: uuid.UUID, active: bool) -> Product:
    product = await _load_product(db, product_id)
    product.is_active = active
    await _audit(
        db, actor, "product.published" if active else "product.unpublished", "product", str(product.id), {}
    )
    await db.commit()
    await _catalogue_event("product.updated", "product", str(product.id))
    return await _load_product(db, product_id)


# --- Variants + prices ---------------------------------------------------------


def _apply_prices(variant: ProductVariant, prices: list[dict]) -> int:
    """Replace the CURRENT price row per role (closes old rows via valid_to)."""
    now = datetime.now(UTC)
    count = 0
    for p in prices:
        role = PriceRole(p["role"])
        if p["selling_price"] > p["mrp"]:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "selling_price cannot exceed mrp")
        # Optional quote band. Both-or-neither, and a real ascending band.
        rmin, rmax = p.get("range_min"), p.get("range_max")
        if (rmin is None) != (rmax is None):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "range needs both min and max")
        if rmin is not None and rmax < rmin:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "range_max must be ≥ range_min")
        for existing in variant.prices:
            if existing.role == role and existing.valid_to is None:
                existing.valid_to = now
        variant.prices.append(
            ProductPrice(
                role=role,
                mrp=p["mrp"],
                selling_price=p["selling_price"],
                range_min=rmin,
                range_max=rmax,
                valid_from=now,
            )
        )
        count += 1
    return count


async def add_variant(db: AsyncSession, actor: User, product_id: uuid.UUID, data: dict) -> Product:
    product = await _load_product(db, product_id)
    prices = data.pop("prices")
    # Initialise the collection in the constructor and price it BEFORE adding —
    # touching the relationship after flush would trigger a lazy load, which is
    # forbidden outside the async greenlet.
    variant = ProductVariant(product_id=product.id, prices=[], **data)
    _apply_prices(variant, prices)
    db.add(variant)
    await db.flush()
    await _audit(db, actor, "variant.created", "product_variant", str(variant.id), {"product": str(product.id)})
    await db.commit()
    await _catalogue_event("product.updated", "product", str(product.id))
    return await _load_product(db, product_id)


async def update_variant(db: AsyncSession, actor: User, variant_id: uuid.UUID, data: dict) -> Product:
    variant = (
        await db.execute(
            select(ProductVariant)
            .options(selectinload(ProductVariant.prices))
            .where(ProductVariant.id == variant_id)
        )
    ).scalar_one_or_none()
    if variant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "variant not found")
    prices = data.pop("prices", None)
    for k, v in {k: v for k, v in data.items() if v is not None}.items():
        setattr(variant, k, v)
    if prices:
        _apply_prices(variant, prices)
    await _audit(db, actor, "variant.updated", "product_variant", str(variant.id), {})
    await db.commit()
    await _catalogue_event("product.updated", "product", str(variant.product_id))
    return await _load_product(db, variant.product_id)


# --- Images --------------------------------------------------------------------


async def create_image_slot(
    db: AsyncSession, actor: User, product_id: uuid.UUID, *, content_type: str, alt: str | None, is_primary: bool
) -> dict:
    product = await _load_product(db, product_id)
    if content_type not in storage.ALLOWED_IMAGE_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "unsupported image type")
    key = storage.make_key("products", content_type=content_type, prefix=product.slug)
    if is_primary:
        for img in product.images:
            img.is_primary = False
    image = ProductImage(
        product_id=product.id,
        storage_key=key,
        alt=alt,
        is_primary=is_primary,
        sort_order=len(product.images),
    )
    db.add(image)
    await db.flush()
    await _audit(db, actor, "product_image.created", "product_image", str(image.id), {"product": str(product.id)})
    await db.commit()
    await _catalogue_event("product.updated", "product", str(product.id))
    return {
        "image_id": image.id,
        "storage_key": key,
        "upload_url": storage.presigned_put(key, content_type=content_type),
        "public_url": storage.public_url(key),
        "expires_in": storage.PRESIGNED_PUT_TTL,
    }


async def add_image_url(
    db: AsyncSession, actor: User, product_id: uuid.UUID, *, url: str, alt: str | None, is_primary: bool
) -> dict:
    """Attach an image by its public URL (stored as the storage key, used
    directly as the image src). Works without object storage configured."""
    product = await _load_product(db, product_id)
    if not product.images:
        is_primary = True  # first image is always primary
    if is_primary:
        for img in product.images:
            img.is_primary = False
    image = ProductImage(
        product_id=product.id,
        storage_key=url.strip(),
        alt=alt,
        is_primary=is_primary,
        sort_order=len(product.images),
    )
    db.add(image)
    await db.flush()
    await _audit(db, actor, "product_image.created", "product_image", str(image.id), {"via": "url"})
    await db.commit()
    await _catalogue_event("product.updated", "product", str(product.id))
    return {"id": image.id, "storage_key": image.storage_key, "alt": image.alt, "is_primary": image.is_primary}


async def set_primary_image(db: AsyncSession, actor: User, image_id: uuid.UUID) -> None:
    image = (
        await db.execute(
            select(ProductImage).where(ProductImage.id == image_id)
        )
    ).scalar_one_or_none()
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "image not found")
    siblings = (
        await db.execute(select(ProductImage).where(ProductImage.product_id == image.product_id))
    ).scalars()
    for img in siblings:
        img.is_primary = img.id == image_id
    await _audit(db, actor, "product_image.set_primary", "product_image", str(image_id), {})
    await db.commit()
    await _catalogue_event("product.updated", "product", str(image.product_id))


async def delete_image(db: AsyncSession, actor: User, image_id: uuid.UUID) -> None:
    image = (await db.execute(select(ProductImage).where(ProductImage.id == image_id))).scalar_one_or_none()
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "image not found")
    key, product_id = image.storage_key, image.product_id
    was_primary = image.is_primary
    await db.delete(image)
    await db.flush()
    # Promote another image to primary if we removed the primary one.
    if was_primary:
        nxt = (
            await db.execute(
                select(ProductImage).where(ProductImage.product_id == product_id).order_by(ProductImage.sort_order).limit(1)
            )
        ).scalar_one_or_none()
        if nxt:
            nxt.is_primary = True
    await _audit(db, actor, "product_image.deleted", "product_image", str(image_id), {})
    await db.commit()
    await storage.delete_object_async(key)
    await _catalogue_event("product.updated", "product", str(product_id))


# --- Categories ------------------------------------------------------------------


async def create_category(db: AsyncSession, actor: User, data: dict) -> Category:
    slug = data.pop("slug", None) or _slugify(data["name"])
    if (await db.execute(select(Category.id).where(Category.slug == slug))).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, f"slug already exists: {slug}")
    parent_slug = data.pop("parent_slug", None)
    parent_id = (await _category_by_slug(db, parent_slug)).id if parent_slug else None
    category = Category(slug=slug, parent_id=parent_id, **data)
    db.add(category)
    await db.flush()
    await _audit(db, actor, "category.created", "category", str(category.id), {"slug": slug})
    await db.commit()
    await _catalogue_event("category.created", "category", str(category.id))
    return category


async def update_category(db: AsyncSession, actor: User, category_id: uuid.UUID, data: dict) -> Category:
    category = (await db.execute(select(Category).where(Category.id == category_id))).scalar_one_or_none()
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "category not found")
    for k, v in {k: v for k, v in data.items() if v is not None}.items():
        setattr(category, k, v)
    await _audit(db, actor, "category.updated", "category", str(category.id), {"fields": sorted(data)})
    await db.commit()
    await _catalogue_event("category.updated", "category", str(category.id))
    return category


async def _load_category(db: AsyncSession, category_id: uuid.UUID) -> Category:
    category = (await db.execute(select(Category).where(Category.id == category_id))).scalar_one_or_none()
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "category not found")
    return category


async def create_category_image_slot(
    db: AsyncSession, actor: User, category_id: uuid.UUID, *, content_type: str
) -> dict:
    """Presigned direct upload for the category tile image."""
    category = await _load_category(db, category_id)
    if content_type not in storage.ALLOWED_IMAGE_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "unsupported image type")
    key = storage.make_key("categories", content_type=content_type, prefix=category.slug)
    category.image_key = key
    await _audit(db, actor, "category.image_set", "category", str(category.id), {"key": key})
    await db.commit()
    await _catalogue_event("category.updated", "category", str(category.id))
    return {
        "upload_url": storage.presigned_put(key, content_type=content_type),
        "storage_key": key,
        "public_url": storage.public_url(key),
    }


async def set_category_image_url(db: AsyncSession, actor: User, category_id: uuid.UUID, *, url: str) -> dict:
    """Set the tile image by public URL (works without object storage)."""
    category = await _load_category(db, category_id)
    category.image_key = url
    await _audit(db, actor, "category.image_set", "category", str(category.id), {"url": url})
    await db.commit()
    await _catalogue_event("category.updated", "category", str(category.id))
    return {"image_key": url}


async def clear_category_image(db: AsyncSession, actor: User, category_id: uuid.UUID) -> None:
    category = await _load_category(db, category_id)
    category.image_key = None
    await _audit(db, actor, "category.image_cleared", "category", str(category.id), {})
    await db.commit()
    await _catalogue_event("category.updated", "category", str(category.id))


async def delete_category(db: AsyncSession, actor: User, category_id: uuid.UUID) -> None:
    category = (await db.execute(select(Category).where(Category.id == category_id))).scalar_one_or_none()
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "category not found")
    in_use = (
        await db.execute(select(func.count()).select_from(Product).where(Product.category_id == category_id))
    ).scalar_one()
    if in_use:
        raise HTTPException(status.HTTP_409_CONFLICT, f"category has {in_use} products — move them first")
    await db.delete(category)
    await _audit(db, actor, "category.deleted", "category", str(category_id), {})
    await db.commit()
    await _catalogue_event("category.deleted", "category", str(category_id))


# --- Admin reads -------------------------------------------------------------------
# The public catalogue hides inactive rows; ops needs to see (and re-publish)
# everything, so these lists are unfiltered.


async def list_products_admin(db: AsyncSession) -> list[dict[str, Any]]:
    rows = (
        (
            await db.execute(
                select(Product)
                .options(
                    selectinload(Product.category),
                    selectinload(Product.variants).selectinload(ProductVariant.prices),
                    selectinload(Product.images),
                )
                .order_by(Product.created_at.desc())
            )
        )
        .scalars()
        .unique()
    )
    out: list[dict[str, Any]] = []
    for p in rows:
        customer_prices = [
            pr.selling_price
            for v in p.variants
            for pr in v.prices
            if pr.valid_to is None and pr.role == PriceRole.customer
        ]
        primary = next((i for i in p.images if i.is_primary), None) or (p.images[0] if p.images else None)
        out.append(
            {
                "id": p.id,
                "slug": p.slug,
                "name": p.name,
                "image_key": storage.image_url(primary.storage_key if primary else None),
                "category_slug": p.category.slug if p.category else "",
                "category_name": p.category.name if p.category else "",
                "sub_category": p.sub_category,
                "schedule": p.schedule.value,
                "stock_status": p.stock_status.value,
                "is_active": p.is_active,
                "is_featured": p.is_featured,
                "gst_rate_pct": p.gst_rate_pct,
                "variant_count": len(p.variants),
                "price_min": min(customer_prices) if customer_prices else None,
                "description": p.description,
                "attributes": p.attributes or {},
                "images": [
                    # The dashboard drops storage_key straight into <img src>, so
                    # serve a renderable URL (keys pass through image_url; absolute
                    # seed/set-by-URL values are untouched).
                    {"id": str(i.id), "storage_key": storage.image_url(i.storage_key), "alt": i.alt, "is_primary": i.is_primary}
                    for i in sorted(p.images, key=lambda x: (not x.is_primary, x.sort_order))
                ],
            }
        )
    return out


async def list_categories_admin(db: AsyncSession) -> list[dict[str, Any]]:
    counts = dict(
        (await db.execute(select(Product.category_id, func.count()).group_by(Product.category_id))).all()
    )
    rows = (await db.execute(select(Category).order_by(Category.sort_order, Category.name))).scalars()
    return [
        {
            "id": c.id,
            "slug": c.slug,
            "name": c.name,
            "description": c.description,
            "sku_prefix": c.sku_prefix,
            "glyph": c.glyph,
            "sort_order": c.sort_order,
            "image_key": storage.image_url(c.image_key),
            "is_active": c.is_active,
            "product_count": counts.get(c.id, 0),
        }
        for c in rows
    ]


# --- Coupons ----------------------------------------------------------------------


async def list_coupons(db: AsyncSession) -> list[Coupon]:
    return list((await db.execute(select(Coupon).order_by(Coupon.created_at.desc()))).scalars())


async def create_coupon(db: AsyncSession, actor: User, data: dict) -> Coupon:
    if data["type"] == "percent" and data["value"] > 100:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "percent value cannot exceed 100")
    if (
        await db.execute(select(Coupon.id).where(Coupon.code == data["code"]))
    ).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "coupon code already exists")
    coupon = Coupon(**{**data, "type": CouponType(data["type"])})
    db.add(coupon)
    await db.flush()
    await _audit(db, actor, "coupon.created", "coupon", str(coupon.id), {"code": coupon.code})
    await db.commit()
    return coupon


async def update_coupon(db: AsyncSession, actor: User, coupon_id: uuid.UUID, data: dict) -> Coupon:
    coupon = (await db.execute(select(Coupon).where(Coupon.id == coupon_id))).scalar_one_or_none()
    if coupon is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "coupon not found")
    for k, v in {k: v for k, v in data.items() if v is not None}.items():
        setattr(coupon, k, v)
    await _audit(db, actor, "coupon.updated", "coupon", str(coupon.id), {"fields": sorted(data)})
    await db.commit()
    return coupon


# --- Serialisation -------------------------------------------------------------------


def serialise_admin_product(p: Product) -> dict[str, Any]:
    return {
        "id": p.id,
        "slug": p.slug,
        "name": p.name,
        "category_slug": p.category.slug if p.category else "",
        "sub_category": p.sub_category,
        "schedule": p.schedule.value,
        "stock_status": p.stock_status.value,
        "is_active": p.is_active,
        "is_featured": p.is_featured,
        "gst_rate_pct": p.gst_rate_pct,
        "variants": [
            {
                "id": v.id,
                "pack_size": v.pack_size,
                "unit_label": v.unit_label,
                "barcode": v.barcode,
                "is_default": v.is_default,
                "sort_order": v.sort_order,
                "prices": [
                    {"role": pr.role.value, "mrp": pr.mrp, "selling_price": pr.selling_price}
                    for pr in v.prices
                    if pr.valid_to is None
                ],
            }
            for v in p.variants
        ],
        "images": [
            {
                "id": i.id,
                "storage_key": storage.image_url(i.storage_key),
                "public_url": storage.public_url(i.storage_key),
                "alt": i.alt,
                "is_primary": i.is_primary,
            }
            for i in p.images
        ],
    }


# --- CSV import -----------------------------------------------------------------------
# One row per variant. Products are upserted by slug, variants by pack_size.
# Columns:
#   name, slug?, category_slug, sub_category?, schedule?, hsn_code?,
#   gst_rate_pct?, is_featured?, pack_size, unit_label,
#   mrp_paise, price_customer_paise, price_clinician_paise?, price_retailer_paise?

REQUIRED_COLUMNS = {"name", "category_slug", "pack_size", "unit_label", "mrp_paise", "price_customer_paise"}
MAX_IMPORT_ROWS = 5000


async def import_catalogue_csv(db: AsyncSession, actor: User, raw: bytes) -> dict[str, Any]:
    try:
        reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
    except UnicodeDecodeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "CSV must be UTF-8 encoded") from None
    if reader.fieldnames is None or not REQUIRED_COLUMNS.issubset(set(reader.fieldnames)):
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"missing columns: {', '.join(sorted(missing))}")

    counts = {
        "total_rows": 0,
        "products_created": 0,
        "products_updated": 0,
        "variants_created": 0,
        "prices_set": 0,
    }
    errors: list[dict[str, Any]] = []
    products_by_slug: dict[str, Product] = {}

    for idx, row in enumerate(reader, start=2):  # row 1 is the header
        counts["total_rows"] += 1
        if counts["total_rows"] > MAX_IMPORT_ROWS:
            errors.append({"row": idx, "error": f"row limit {MAX_IMPORT_ROWS} exceeded — split the file"})
            break
        try:
            slug = (row.get("slug") or "").strip() or _slugify(row["name"])
            product = products_by_slug.get(slug)
            if product is None:
                product = (
                    await db.execute(
                        select(Product)
                        .options(selectinload(Product.variants).selectinload(ProductVariant.prices))
                        .where(Product.slug == slug)
                    )
                ).scalar_one_or_none()
            if product is None:
                category = await _category_by_slug(db, row["category_slug"].strip())
                product = Product(
                    slug=slug,
                    name=row["name"].strip(),
                    category_id=category.id,
                    sub_category=(row.get("sub_category") or "").strip() or None,
                    schedule=ScheduleClass((row.get("schedule") or "NONE").strip() or "NONE"),
                    hsn_code=(row.get("hsn_code") or "").strip() or None,
                    gst_rate_pct=int(row.get("gst_rate_pct") or 12),
                    is_featured=(row.get("is_featured") or "").strip().lower() in ("1", "true", "yes"),
                    stock_status=StockStatus.in_stock,
                )
                product.variants = []
                db.add(product)
                await db.flush()
                counts["products_created"] += 1
            else:
                counts["products_updated"] += 1
            products_by_slug[slug] = product

            pack_size = row["pack_size"].strip()
            variant = next((v for v in product.variants if v.pack_size == pack_size), None)
            if variant is None:
                variant = ProductVariant(
                    product_id=product.id,
                    pack_size=pack_size,
                    unit_label=row["unit_label"].strip(),
                    is_default=not product.variants,
                )
                variant.prices = []
                product.variants.append(variant)
                await db.flush()
                counts["variants_created"] += 1

            mrp = int(row["mrp_paise"])
            prices = [{"role": "customer", "mrp": mrp, "selling_price": int(row["price_customer_paise"])}]
            for role in ("clinician", "retailer"):
                cell = (row.get(f"price_{role}_paise") or "").strip()
                if cell:
                    prices.append({"role": role, "mrp": mrp, "selling_price": int(cell)})
            counts["prices_set"] += _apply_prices(variant, prices)
        except HTTPException as e:
            errors.append({"row": idx, "error": str(e.detail)})
        except (KeyError, ValueError) as e:
            errors.append({"row": idx, "error": f"bad value: {e}"})

    await _audit(db, actor, "catalogue.imported", "catalogue", "csv", counts | {"errors": len(errors)})
    await db.commit()
    await _catalogue_event("catalogue.imported", "catalogue", "csv")
    log.info("catalogue.imported", **counts)
    return counts | {"errors": errors}
