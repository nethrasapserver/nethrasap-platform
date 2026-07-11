"""Categories endpoints — list + detail."""
from __future__ import annotations

from fastapi import APIRouter

from ...db import DbSession
from ...schemas.category import CategoryItem
from ...schemas.common import Paginated
from ...services import catalogue as svc

router = APIRouter()


@router.get("", response_model=Paginated[CategoryItem])
async def list_categories(db: DbSession) -> Paginated[CategoryItem]:
    items = await svc.list_categories(db)
    return Paginated[CategoryItem](
        total=len(items),
        limit=len(items),
        offset=0,
        items=[CategoryItem.model_validate(item) for item in items],
    )


@router.get("/{slug}", response_model=CategoryItem)
async def get_category(slug: str, db: DbSession) -> CategoryItem:
    item = await svc.get_category_by_slug(db, slug=slug)
    return CategoryItem.model_validate(item)
