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
    brand: str | None = Query(
        None,
        description="Filter by one or more brands, comma-separated. e.g. brand=Cipla,Sun Pharma",
    ),
    schedule: str | None = Query(None, description="Filter by schedule class: H / H1 / X"),
    in_stock: bool | None = Query(None, description="Only return in-stock items"),
    featured: bool | None = Query(None, description="Only return featured items"),
    sort: Literal["relevance", "price-asc", "price-desc", "rating", "popular"] = Query(
        "relevance", description="Sort order. Non-relevance sorts override ts_rank when q is set."
    ),
) -> Paginated[ProductListItem]:
    brands = [b.strip() for b in brand.split(",")] if brand else None
    total, items = await svc.list_products(
        db,
        user=user,
        q=q,
        category_slug=category,
        sub_category=sub_category,
        brands=brands,
        schedule=schedule,
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


@router.get("/{slug}", response_model=ProductDetail)
async def get_product(slug: str, db: DbSession, user: OptionalUser) -> ProductDetail:
    item = await svc.get_product_by_slug(db, slug=slug, user=user)
    return ProductDetail.model_validate(item)
