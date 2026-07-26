"""Wishlist + compare tray — per-user saved products, realtime-synced.

Every mutation commits, then publishes `wishlist.updated` / `compare.updated`
on the owner's user channel. Payloads carry ids + counts only (hub envelope
convention): other devices/tabs refetch the list they care about, so a phone
and a desktop session never drift.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..logging import get_logger
from ..models.catalogue import Product, ProductVariant
from ..models.saved_items import CompareItem, WishlistItem
from ..models.user import User
from ..realtime import publish_event
from ..realtime.channels import user_channel
from .catalogue import price_role_for_user, serialize_product_card

log = get_logger("services.saved_items")

# The comparison table renders side-by-side columns; more than 4 is unreadable.
COMPARE_MAX = 4


# --- Wishlist ---------------------------------------------------------------


async def get_wishlist(db: AsyncSession, *, user: User) -> dict[str, Any]:
    return await _serialise(db, model=WishlistItem, user=user)


async def add_to_wishlist(db: AsyncSession, *, user: User, product_id: uuid.UUID) -> dict[str, Any]:
    """Idempotent add — saving an already-saved product is a no-op."""
    await _ensure_product(db, product_id)
    added = await _insert_ignore_duplicate(
        db, model=WishlistItem, user_id=user.id, product_id=product_id
    )
    result = await _serialise(db, model=WishlistItem, user=user)
    if added:
        await _publish(user, kind="wishlist", action="added", product_id=product_id, count=result["count"])
    return result


async def remove_from_wishlist(
    db: AsyncSession, *, user: User, product_id: uuid.UUID
) -> dict[str, Any]:
    """Idempotent remove — removing an absent product is a no-op."""
    removed = await _delete_item(db, model=WishlistItem, user=user, product_id=product_id)
    result = await _serialise(db, model=WishlistItem, user=user)
    if removed:
        await _publish(user, kind="wishlist", action="removed", product_id=product_id, count=result["count"])
    return result


# --- Compare tray -----------------------------------------------------------


async def get_compare(db: AsyncSession, *, user: User) -> dict[str, Any]:
    return {**await _serialise(db, model=CompareItem, user=user), "max_items": COMPARE_MAX}


async def add_to_compare(db: AsyncSession, *, user: User, product_id: uuid.UUID) -> dict[str, Any]:
    await _ensure_product(db, product_id)

    existing_ids = (
        (await db.execute(select(CompareItem.product_id).where(CompareItem.user_id == user.id)))
        .scalars()
        .all()
    )
    added = False
    if product_id not in existing_ids:
        if len(existing_ids) >= COMPARE_MAX:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"compare tray is full ({COMPARE_MAX} products max) — remove one first",
            )
        added = await _insert_ignore_duplicate(
            db, model=CompareItem, user_id=user.id, product_id=product_id
        )

    result = {**await _serialise(db, model=CompareItem, user=user), "max_items": COMPARE_MAX}
    if added:
        await _publish(user, kind="compare", action="added", product_id=product_id, count=result["count"])
    return result


async def remove_from_compare(
    db: AsyncSession, *, user: User, product_id: uuid.UUID
) -> dict[str, Any]:
    removed = await _delete_item(db, model=CompareItem, user=user, product_id=product_id)
    result = {**await _serialise(db, model=CompareItem, user=user), "max_items": COMPARE_MAX}
    if removed:
        await _publish(user, kind="compare", action="removed", product_id=product_id, count=result["count"])
    return result


async def clear_compare(db: AsyncSession, *, user: User) -> dict[str, Any]:
    await db.execute(delete(CompareItem).where(CompareItem.user_id == user.id))
    await db.commit()
    await _publish(user, kind="compare", action="cleared", product_id=None, count=0)
    return {"items": [], "product_ids": [], "count": 0, "max_items": COMPARE_MAX}


# --- Internals ----------------------------------------------------------------


async def _ensure_product(db: AsyncSession, product_id: uuid.UUID) -> None:
    exists = (
        await db.execute(
            select(Product.id).where(Product.id == product_id, Product.is_active.is_(True))
        )
    ).scalar_one_or_none()
    if exists is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")


async def _insert_ignore_duplicate(
    db: AsyncSession,
    *,
    model: type[WishlistItem] | type[CompareItem],
    user_id: uuid.UUID,
    product_id: uuid.UUID,
) -> bool:
    """Atomic idempotent insert via ON CONFLICT DO NOTHING.

    Deliberately not try/except-IntegrityError: a rollback would expire every
    loaded instance (including the request's `user`) mid-request, and the next
    attribute access would lazy-load synchronously inside the async session.
    """
    stmt = (
        pg_insert(model)
        .values(id=uuid.uuid4(), user_id=user_id, product_id=product_id)
        .on_conflict_do_nothing(index_elements=["user_id", "product_id"])
    )
    result = await db.execute(stmt)
    await db.commit()
    return bool(result.rowcount)


async def _delete_item(
    db: AsyncSession,
    *,
    model: type[WishlistItem] | type[CompareItem],
    user: User,
    product_id: uuid.UUID,
) -> bool:
    result = await db.execute(
        delete(model).where(model.user_id == user.id, model.product_id == product_id)
    )
    await db.commit()
    return bool(result.rowcount)


async def _serialise(
    db: AsyncSession, *, model: type[WishlistItem] | type[CompareItem], user: User
) -> dict[str, Any]:
    """List the saved rows with role-aware product cards, newest first."""
    rows = (
        (
            await db.execute(
                select(model).where(model.user_id == user.id).order_by(model.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    product_ids = [r.product_id for r in rows]

    products_by_id: dict[uuid.UUID, Product] = {}
    if product_ids:
        products = (
            (
                await db.execute(
                    select(Product)
                    .options(
                        selectinload(Product.category),
                        selectinload(Product.variants).selectinload(ProductVariant.prices),
                        selectinload(Product.images),
                    )
                    .where(Product.id.in_(product_ids), Product.is_active.is_(True))
                )
            )
            .scalars()
            .unique()
            .all()
        )
        products_by_id = {p.id: p for p in products}

    price_role = price_role_for_user(user)
    items = [
        {
            "product": serialize_product_card(products_by_id[r.product_id], price_role),
            "added_at": r.created_at,
        }
        for r in rows
        if r.product_id in products_by_id  # deactivated products drop out of the view
    ]
    return {
        "items": items,
        "product_ids": [r.product_id for r in rows if r.product_id in products_by_id],
        "count": len(items),
    }


async def _publish(
    user: User, *, kind: str, action: str, product_id: uuid.UUID | None, count: int
) -> None:
    await publish_event(
        user_channel(str(user.id)),
        type=f"{kind}.updated",
        entity=kind,
        entity_id=str(product_id) if product_id else "",
        payload={"action": action, "count": count},
    )
