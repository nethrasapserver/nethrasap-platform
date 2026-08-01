"""Review queries — list + upsert."""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..logging import get_logger
from ..models.audit import AuditLog
from ..models.catalogue import Product, ProductVariant, Review
from ..models.order import Order, OrderItem, OrderStatus
from ..models.user import User, UserProfile

log = get_logger("services.reviews")


def _serialize_review(review: Review, profile: UserProfile | None, user_role: str) -> dict[str, Any]:
    return {
        "id": review.id,
        "rating": int(review.rating),
        "title": review.title,
        "body": review.body,
        "is_verified_purchase": review.is_verified_purchase,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
        "author": {
            "id": review.user_id,
            "full_name": (profile.full_name if profile else "Customer"),
            "role": user_role,
        },
    }


async def _resolve_product_by_slug(db: AsyncSession, slug: str) -> Product:
    product = (
        await db.execute(select(Product).where(Product.slug == slug))
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
    return product


async def _has_purchased(db: AsyncSession, *, user_id, product_id) -> bool:
    """True if the user has any non-cancelled order that contains this product.

    H-20: reviews require proof of purchase. Order items reference a variant, so
    we hop order → order_items → product_variants → product. Any order that
    isn't cancelled counts (placed / paid / dispatched / delivered) — the
    simplest correct verified-purchase check for a COD-heavy catalogue where
    cash isn't captured until delivery.
    """
    stmt = (
        select(OrderItem.id)
        .join(Order, Order.id == OrderItem.order_id)
        .join(ProductVariant, ProductVariant.id == OrderItem.variant_id)
        .where(
            Order.user_id == user_id,
            Order.status != OrderStatus.cancelled,
            ProductVariant.product_id == product_id,
        )
        .limit(1)
    )
    return (await db.execute(stmt)).first() is not None


async def list_reviews(
    db: AsyncSession,
    *,
    product_slug: str,
    limit: int = 20,
    offset: int = 0,
) -> tuple[int, list[dict]]:
    product = await _resolve_product_by_slug(db, product_slug)

    count_stmt = select(func.count()).select_from(
        select(Review.id).where(Review.product_id == product.id).subquery()
    )
    total = (await db.execute(count_stmt)).scalar_one()

    rows_stmt = (
        select(Review, UserProfile, User.role)
        .join(User, User.id == Review.user_id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .where(Review.product_id == product.id)
        .order_by(Review.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(rows_stmt)).all()

    items = [_serialize_review(r, p, role.value) for r, p, role in rows]
    return total, items


async def upsert_review(
    db: AsyncSession,
    *,
    user: User,
    product_slug: str,
    payload,
    ip: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any]:
    """Insert-or-update the caller's review for the given product.

    One review per user per product (enforced by uq_reviews_user_id_product_id).
    Postgres `ON CONFLICT … DO UPDATE` keeps the operation atomic. The DB
    trigger `reviews_recompute_aiud` refreshes the product's denorm rating
    and reviews_count.
    """
    product = await _resolve_product_by_slug(db, product_slug)

    # H-20: only a verified purchaser may review. Without this any logged-in
    # user could post (and a payload review dragged a product to 1.0).
    if not await _has_purchased(db, user_id=user.id, product_id=product.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "purchase required to review"
        )

    stmt = (
        pg_insert(Review)
        .values(
            product_id=product.id,
            user_id=user.id,
            rating=payload.rating,
            title=payload.title,
            body=payload.body,
            is_verified_purchase=True,
        )
        .on_conflict_do_update(
            constraint="uq_reviews_user_id_product_id",
            set_={
                "rating": payload.rating,
                "title": payload.title,
                "body": payload.body,
                "is_verified_purchase": True,
                "updated_at": func.now(),
            },
        )
        .returning(Review)
    )
    result = await db.execute(stmt)
    review = result.scalar_one()

    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="review.upsert",
            entity_type="product",
            entity_id=str(product.id),
            payload={"rating": payload.rating, "product_slug": product.slug},
            ip=ip,
            user_agent=user_agent,
        )
    )
    await db.commit()
    await db.refresh(review)

    profile = user.profile if hasattr(user, "profile") else None
    log.info(
        "review.upsert",
        user_id=str(user.id),
        product_id=str(product.id),
        rating=payload.rating,
    )
    return _serialize_review(review, profile, user.role.value)
