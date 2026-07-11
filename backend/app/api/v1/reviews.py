"""Reviews endpoints — list + create/update."""
from __future__ import annotations

from fastapi import APIRouter, status

from ...db import DbSession
from ...deps import ClientMeta, CurrentUser, Paged
from ...schemas.common import Paginated
from ...schemas.review import ReviewCreate, ReviewOut
from ...services import reviews as svc

router = APIRouter()


@router.get("/{slug}/reviews", response_model=Paginated[ReviewOut])
async def list_reviews(
    slug: str, db: DbSession, pagination: Paged
) -> Paginated[ReviewOut]:
    total, items = await svc.list_reviews(
        db,
        product_slug=slug,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return Paginated[ReviewOut](
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        items=[ReviewOut.model_validate(item) for item in items],
    )


@router.post(
    "/{slug}/reviews",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_or_update_review(
    slug: str,
    payload: ReviewCreate,
    db: DbSession,
    user: CurrentUser,
    meta: ClientMeta,
) -> ReviewOut:
    item = await svc.upsert_review(
        db,
        user=user,
        product_slug=slug,
        payload=payload,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
    )
    return ReviewOut.model_validate(item)
