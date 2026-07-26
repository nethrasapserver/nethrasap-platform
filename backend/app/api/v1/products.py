"""Products endpoints — list + detail."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query

from ...db import DbSession
from ...deps import OptionalUser, Paged
from ...schemas.common import Paginated
from ...schemas.product import ProductDetail, ProductListItem
from ...services import catalogue as svc

router = APIRouter()


@router.get("", response_model=Paginated[ProductListItem])
async def list_products(
    db: DbSession,
    pagination: Paged,
    user: OptionalUser,
    q: str | None = Query(None, description="Free-text search across name + brand + description"),
    category: str | None = Query(None, description="Filter by category slug"),
    sub_category: str | None = Query(
        None, description="Filter by sub_category label (case-insensitive)"
    ),
    schedule: str | None = Query(None, description="Filter by schedule class: H / H1 / X"),
    prescription: bool | None = Query(
        None, description="true = prescription-only (any schedule); false = over-the-counter"
    ),
    price_min: int | None = Query(None, ge=0, description="Minimum price in paise"),
    price_max: int | None = Query(None, ge=0, description="Maximum price in paise"),
    in_stock: bool | None = Query(None, description="Only return in-stock items"),
    featured: bool | None = Query(None, description="Only return featured items"),
    sort: Literal["relevance", "price-asc", "price-desc", "rating", "popular"] = Query(
        "relevance", description="Sort order. Non-relevance sorts override ts_rank when q is set."
    ),
) -> Paginated[ProductListItem]:
    total, items = await svc.list_products(
        db,
        user=user,
        q=q,
        category_slug=category,
        sub_category=sub_category,
        schedule=schedule,
        prescription=prescription,
        price_min=price_min,
        price_max=price_max,
        in_stock=in_stock,
        is_featured=featured,
        sort=sort,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return Paginated[ProductListItem](
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        items=[ProductListItem.model_validate(item) for item in items],
    )


@router.get("/facets")
async def facets(db: DbSession, user: OptionalUser) -> dict:
    """Brands + price range for the products-page filter sidebar."""
    return await svc.product_facets(db, user=user)


@router.get("/{slug}/related", response_model=list[ProductListItem])
async def related_products(
    slug: str, db: DbSession, user: OptionalUser
) -> list[ProductListItem]:
    """Alternatives to this product, priced at the caller's tier."""
    rows = await svc.list_related(db, slug=slug, user=user, limit=8)
    return [ProductListItem.model_validate(r) for r in rows]


@router.get("/{slug}", response_model=ProductDetail)
async def get_product(slug: str, db: DbSession, user: OptionalUser) -> ProductDetail:
    item = await svc.get_product_by_slug(db, slug=slug, user=user)
    return ProductDetail.model_validate(item)
