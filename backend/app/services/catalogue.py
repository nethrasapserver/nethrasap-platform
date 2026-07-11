"""Catalogue queries — products, categories, role-aware pricing."""
from __future__ import annotations

from typing import Any, Literal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.catalogue import (
    Category,
    PriceRole,
    Product,
    ProductPrice,
    ProductVariant,
    ScheduleClass,
    StockStatus,
)
from ..models.user import User, UserRole, UserStatus

SortOption = Literal["relevance", "price-asc", "price-desc", "rating", "popular"]
VALID_SORTS: tuple[SortOption, ...] = ("relevance", "price-asc", "price-desc", "rating", "popular")


def _price_role_for_user(user: User | None) -> PriceRole:
    """Resolve the price tier the caller is entitled to see.

    - Anonymous / customer / unverified → customer (MRP-equivalent).
    - Verified clinician → clinician.
    - Verified retailer → retailer.
    - Portal users (sales/manager/admin) → retailer (they price-shop on behalf).
    """
    if user is None:
        return PriceRole.customer
    if user.status == UserStatus.pending_kyc:
        return PriceRole.customer
    match user.role:
        case UserRole.clinician:
            return PriceRole.clinician
        case UserRole.retailer | UserRole.sales | UserRole.manager | UserRole.admin:
            return PriceRole.retailer
        case _:
            return PriceRole.customer


def _serialize_product(product: Product, price_role: PriceRole) -> dict[str, Any]:
    """Flatten product+default variant+role-active price into the list shape."""
    default_variant = next(
        (v for v in product.variants if v.is_default),
        product.variants[0] if product.variants else None,
    )

    price_min = 0
    price_max = 0
    unit_label = ""

    if default_variant is not None:
        unit_label = default_variant.unit_label
        active_price = next(
            (p for p in default_variant.prices if p.role == price_role and p.valid_to is None),
            None,
        )
        if active_price is None:
            # Fallback: try the customer (MRP) tier.
            active_price = next(
                (
                    p
                    for p in default_variant.prices
                    if p.role == PriceRole.customer and p.valid_to is None
                ),
                None,
            )
        if active_price is not None:
            price_min = active_price.selling_price
            price_max = active_price.mrp

    return {
        "id": product.id,
        "slug": product.slug,
        "name": product.name,
        "brand": product.brand,
        "category_slug": product.category.slug if product.category else "",
        "category_name": product.category.name if product.category else "",
        "sub_category": product.sub_category,
        "stock_status": product.stock_status.value,
        "rating": float(product.rating or 0),
        "reviews": product.reviews_count,
        "price_min": price_min,
        "price_max": price_max,
        "is_featured": product.is_featured,
        "badge": product.badge,
        "delivery_time_mins": product.delivery_time_mins,
        "unit_label": unit_label,
        "schedule": product.schedule.value,
    }


# --- Public queries -------------------------------------------------------


def _default_variant_price_subquery(price_role: PriceRole):
    """Correlated scalar subquery: active selling_price for the product's
    default variant at the caller's price tier, falling back to customer tier.

    Returns NULL if no price row exists (product effectively unpriced for caller).
    """
    # First-choice price: caller's role
    role_price = (
        select(ProductPrice.selling_price)
        .join(ProductVariant, ProductVariant.id == ProductPrice.variant_id)
        .where(
            ProductVariant.product_id == Product.id,
            ProductVariant.is_default.is_(True),
            ProductPrice.role == price_role,
            ProductPrice.valid_to.is_(None),
        )
        .limit(1)
    )
    if price_role == PriceRole.customer:
        return role_price.scalar_subquery()

    # Fallback: customer tier when role-specific row is missing
    customer_price = (
        select(ProductPrice.selling_price)
        .join(ProductVariant, ProductVariant.id == ProductPrice.variant_id)
        .where(
            ProductVariant.product_id == Product.id,
            ProductVariant.is_default.is_(True),
            ProductPrice.role == PriceRole.customer,
            ProductPrice.valid_to.is_(None),
        )
        .limit(1)
    )
    return func.coalesce(role_price.scalar_subquery(), customer_price.scalar_subquery())


async def list_products(
    db: AsyncSession,
    *,
    user: User | None = None,
    q: str | None = None,
    category_slug: str | None = None,
    sub_category: str | None = None,
    brands: list[str] | None = None,
    schedule: str | None = None,
    in_stock: bool | None = None,
    is_featured: bool | None = None,
    sort: SortOption = "relevance",
    limit: int = 20,
    offset: int = 0,
) -> tuple[int, list[dict]]:
    if sort not in VALID_SORTS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"invalid sort: {sort}. Must be one of: {', '.join(VALID_SORTS)}",
        )

    price_role = _price_role_for_user(user)

    base = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.variants).selectinload(ProductVariant.prices),
        )
        .where(Product.is_active.is_(True))
    )

    if category_slug:
        base = base.join(Category, Category.id == Product.category_id).where(
            Category.slug == category_slug
        )
    if sub_category:
        base = base.where(func.lower(Product.sub_category) == sub_category.lower())
    if brands:
        cleaned = [b.strip() for b in brands if b and b.strip()]
        if cleaned:
            base = base.where(Product.brand.in_(cleaned))
    if schedule:
        try:
            sched_enum = ScheduleClass(schedule.upper())
        except ValueError:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"invalid schedule: {schedule}"
            ) from None
        base = base.where(Product.schedule == sched_enum)
    if in_stock is True:
        base = base.where(Product.stock_status == StockStatus.in_stock)
    elif in_stock is False:
        base = base.where(Product.stock_status != StockStatus.in_stock)
    if is_featured is True:
        base = base.where(Product.is_featured.is_(True))

    # Sort precedence: explicit non-relevance sorts always win.
    if sort == "price-asc":
        price_expr = _default_variant_price_subquery(price_role)
        # Apply q filter (without ts_rank ordering) before sorting by price.
        if q:
            ts_query = func.plainto_tsquery("english", q)
            base = base.where(Product.search_tsv.op("@@")(ts_query))
        base = base.order_by(price_expr.asc().nulls_last(), Product.name.asc())
    elif sort == "price-desc":
        price_expr = _default_variant_price_subquery(price_role)
        if q:
            ts_query = func.plainto_tsquery("english", q)
            base = base.where(Product.search_tsv.op("@@")(ts_query))
        base = base.order_by(price_expr.desc().nulls_last(), Product.name.asc())
    elif sort == "rating":
        if q:
            ts_query = func.plainto_tsquery("english", q)
            base = base.where(Product.search_tsv.op("@@")(ts_query))
        base = base.order_by(
            Product.rating.desc(),
            Product.reviews_count.desc(),
            Product.name.asc(),
        )
    elif sort == "popular":
        if q:
            ts_query = func.plainto_tsquery("english", q)
            base = base.where(Product.search_tsv.op("@@")(ts_query))
        base = base.order_by(
            Product.reviews_count.desc(),
            Product.rating.desc(),
            Product.name.asc(),
        )
    else:  # relevance
        if q:
            ts_query = func.plainto_tsquery("english", q)
            base = base.where(Product.search_tsv.op("@@")(ts_query))
            rank = func.ts_rank(Product.search_tsv, ts_query)
            base = base.order_by(rank.desc(), Product.name.asc())
        else:
            base = base.order_by(Product.is_featured.desc(), Product.name.asc())

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    rows_stmt = base.limit(limit).offset(offset)
    products = (await db.execute(rows_stmt)).scalars().unique().all()

    return total, [_serialize_product(p, price_role) for p in products]


async def get_product_by_slug(
    db: AsyncSession, *, slug: str, user: User | None = None
) -> dict[str, Any]:
    price_role = _price_role_for_user(user)
    stmt = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.variants).selectinload(ProductVariant.prices),
            selectinload(Product.images),
        )
        .where(Product.slug == slug, Product.is_active.is_(True))
    )
    product = (await db.execute(stmt)).scalar_one_or_none()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")

    base = _serialize_product(product, price_role)
    return {
        **base,
        "description": product.description,
        "hsn_code": product.hsn_code,
        "specs": product.specs or [],
        "variants": [
            {
                "id": v.id,
                "pack_size": v.pack_size,
                "unit_label": v.unit_label,
                "barcode": v.barcode,
                "is_default": v.is_default,
                "prices": [
                    {
                        "role": p.role.value,
                        "mrp": p.mrp,
                        "selling_price": p.selling_price,
                        "currency": p.currency,
                    }
                    for p in v.prices
                    if p.valid_to is None
                ],
            }
            for v in product.variants
        ],
        "images": [
            {
                "storage_key": img.storage_key,
                "alt": img.alt,
                "is_primary": img.is_primary,
                "sort_order": img.sort_order,
            }
            for img in product.images
        ],
    }


async def list_categories(db: AsyncSession) -> list[dict]:
    stmt = (
        select(
            Category,
            func.count(Product.id).label("product_count"),
        )
        .outerjoin(Product, (Product.category_id == Category.id) & (Product.is_active.is_(True)))
        .where(Category.is_active.is_(True), Category.parent_id.is_(None))
        .group_by(Category.id)
        .order_by(Category.sort_order, Category.name)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": cat.id,
            "slug": cat.slug,
            "name": cat.name,
            "description": cat.description,
            "sku_prefix": cat.sku_prefix,
            "glyph": cat.glyph,
            "image_key": cat.image_key,
            "sort_order": cat.sort_order,
            "is_active": cat.is_active,
            "product_count": int(count),
        }
        for cat, count in rows
    ]


async def get_category_by_slug(db: AsyncSession, *, slug: str) -> dict:
    stmt = (
        select(
            Category,
            func.count(Product.id).label("product_count"),
        )
        .outerjoin(Product, (Product.category_id == Category.id) & (Product.is_active.is_(True)))
        .where(Category.slug == slug, Category.is_active.is_(True))
        .group_by(Category.id)
    )
    row = (await db.execute(stmt)).one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "category not found")
    cat, count = row
    return {
        "id": cat.id,
        "slug": cat.slug,
        "name": cat.name,
        "description": cat.description,
        "sku_prefix": cat.sku_prefix,
        "glyph": cat.glyph,
        "image_key": cat.image_key,
        "sort_order": cat.sort_order,
        "is_active": cat.is_active,
        "product_count": int(count),
    }
