"""Inventory service — receive, adjust, and the reserve/release/fulfil cycle
that makes overselling impossible.

Reservation runs inside the caller's checkout transaction (no commit here) and
locks each affected stock row with `SELECT … FOR UPDATE`, ordered by
variant_id so concurrent orders can't deadlock. A variant with no stock row is
UNTRACKED and passes through unblocked.

Every quantity change appends a `stock_ledger` row; the levels table is a
running cache the ledger can fully reconstruct.
"""
from __future__ import annotations

import uuid
from typing import Any, NamedTuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..logging import get_logger
from ..models.catalogue import Product, ProductVariant, StockStatus
from ..models.inventory import StockLedger, StockLevel, StockMovement, Warehouse
from ..models.user import User
from ..realtime import publish_event
from ..realtime.channels import topic_channel

log = get_logger("services.inventory")


class LineReservation(NamedTuple):
    variant_id: uuid.UUID
    quantity: int


async def default_warehouse_id(db: AsyncSession) -> uuid.UUID:
    wid = (
        await db.execute(select(Warehouse.id).where(Warehouse.code == "MAIN"))
    ).scalar_one_or_none()
    if wid is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "no default warehouse configured")
    return wid


def _ledger(
    *,
    variant_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    movement: StockMovement,
    quantity: int,
    reason: str | None = None,
    ref_type: str | None = None,
    ref_id: str | None = None,
    actor: User | None = None,
    note: str | None = None,
) -> StockLedger:
    return StockLedger(
        variant_id=variant_id,
        warehouse_id=warehouse_id,
        movement=movement,
        quantity=quantity,
        reason=reason,
        ref_type=ref_type,
        ref_id=ref_id,
        actor_user_id=actor.id if actor else None,
        note=note,
    )


# --- Derived product status --------------------------------------------------


async def refresh_product_status(db: AsyncSession, variant_id: uuid.UUID) -> None:
    """Recompute `products.stock_status` from all tracked variants of the
    product this variant belongs to, and publish a catalogue event if it flipped.

    Aggregate rule across the product's variants (only tracked ones count):
      any available > 0            → in_stock (unless every level ≤ reorder → low_stock)
      total available == 0         → out_of_stock
    Discontinued is admin-only and never overwritten here.
    """
    product_id = (
        await db.execute(select(ProductVariant.product_id).where(ProductVariant.id == variant_id))
    ).scalar_one_or_none()
    if product_id is None:
        return

    rows = (
        await db.execute(
            select(
                func.coalesce(func.sum(StockLevel.on_hand - StockLevel.reserved), 0),
                func.coalesce(func.sum(StockLevel.reorder_point), 0),
                func.count(StockLevel.id),
            )
            .join(ProductVariant, ProductVariant.id == StockLevel.variant_id)
            .where(ProductVariant.product_id == product_id)
        )
    ).one()
    total_available, total_reorder, tracked_count = int(rows[0]), int(rows[1]), int(rows[2])

    if tracked_count == 0:
        return  # product is untracked — leave admin-set status alone

    product = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
    if product.stock_status == StockStatus.discontinued:
        return

    if total_available <= 0:
        new_status = StockStatus.out_of_stock
    elif total_available <= total_reorder:
        new_status = StockStatus.low_stock
    else:
        new_status = StockStatus.in_stock

    if product.stock_status != new_status:
        product.stock_status = new_status
        await publish_event(
            topic_channel("catalogue"),
            type="product.updated",
            entity="product",
            entity_id=str(product_id),
            payload={"stock_status": new_status.value},
        )
        if new_status in (StockStatus.low_stock, StockStatus.out_of_stock):
            await publish_event(
                topic_channel("inventory"),
                type="inventory.low_stock",
                entity="product",
                entity_id=str(product_id),
                payload={"stock_status": new_status.value, "available": total_available},
            )


async def _get_level_for_update(
    db: AsyncSession, variant_id: uuid.UUID, warehouse_id: uuid.UUID
) -> StockLevel | None:
    return (
        await db.execute(
            select(StockLevel)
            .where(StockLevel.variant_id == variant_id, StockLevel.warehouse_id == warehouse_id)
            .with_for_update()
        )
    ).scalar_one_or_none()


# --- Admin operations (each commits) ------------------------------------------


async def receive_stock(
    db: AsyncSession,
    actor: User,
    *,
    variant_id: uuid.UUID,
    warehouse_id: uuid.UUID | None,
    quantity: int,
    reorder_point: int | None = None,
    note: str | None = None,
) -> StockLevel:
    if quantity <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "quantity must be positive")
    warehouse_id = warehouse_id or await default_warehouse_id(db)
    await _ensure_variant(db, variant_id)

    level = await _get_level_for_update(db, variant_id, warehouse_id)
    if level is None:
        level = StockLevel(
            variant_id=variant_id,
            warehouse_id=warehouse_id,
            on_hand=0,
            reserved=0,
            reorder_point=reorder_point or 0,
        )
        db.add(level)
    level.on_hand += quantity
    if reorder_point is not None:
        level.reorder_point = reorder_point

    db.add(_ledger(
        variant_id=variant_id, warehouse_id=warehouse_id,
        movement=StockMovement.receipt, quantity=quantity, actor=actor, note=note,
    ))
    await db.flush()
    await refresh_product_status(db, variant_id)
    await db.commit()
    log.info("stock.received", variant_id=str(variant_id), quantity=quantity)
    return await _reload_level(db, level.id)


async def adjust_stock(
    db: AsyncSession,
    actor: User,
    *,
    variant_id: uuid.UUID,
    warehouse_id: uuid.UUID | None,
    delta: int,
    reason: str,
    note: str | None = None,
) -> StockLevel:
    if delta == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "delta cannot be zero")
    warehouse_id = warehouse_id or await default_warehouse_id(db)
    level = await _get_level_for_update(db, variant_id, warehouse_id)
    if level is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no stock record — receive stock first")
    if level.on_hand + delta < level.reserved:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"adjustment would drop on_hand below reserved ({level.reserved})",
        )
    level.on_hand += delta

    db.add(_ledger(
        variant_id=variant_id, warehouse_id=warehouse_id,
        movement=StockMovement.adjustment, quantity=delta, reason=reason, actor=actor, note=note,
    ))
    await db.flush()
    await refresh_product_status(db, variant_id)
    await db.commit()
    log.info("stock.adjusted", variant_id=str(variant_id), delta=delta, reason=reason)
    return await _reload_level(db, level.id)


# --- Order lifecycle (no commit — runs inside the caller's transaction) -------


async def reserve_for_order(
    db: AsyncSession, *, lines: list[LineReservation], order_number: str, actor: User | None = None
) -> None:
    """Reserve stock for tracked variants. Raises 409 if any is short.

    Lock order is deterministic (sorted by variant_id) so two concurrent
    checkouts touching the same variants can never deadlock.
    """
    warehouse_id = await default_warehouse_id(db)
    touched: list[uuid.UUID] = []
    for line in sorted(lines, key=lambda x: str(x.variant_id)):
        level = await _get_level_for_update(db, line.variant_id, warehouse_id)
        if level is None:
            # UNTRACKED variant — no stock_levels row. This is a DELIBERATE,
            # documented state (docs/b3-b4-plan.md "Tracked vs untracked
            # policy"): a variant is unenforced/unlimited until its first
            # `receive_stock` creates the row and flips it to tracked, so the
            # existing catalogue keeps selling while stock is onboarded
            # gradually. It is NOT an accidental oversell hole — reservation
            # (and fulfil) intentionally pass through. Do not gate here without
            # changing that policy (and the H-6 note to the lead).
            continue  # untracked variant — sells freely by design
        available = level.on_hand - level.reserved
        if available < line.quantity:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"insufficient stock (need {line.quantity}, have {available})",
            )
        level.reserved += line.quantity
        db.add(_ledger(
            variant_id=line.variant_id, warehouse_id=warehouse_id,
            movement=StockMovement.reservation, quantity=line.quantity,
            ref_type="order", ref_id=order_number, actor=actor,
        ))
        touched.append(line.variant_id)
    await db.flush()
    for vid in touched:
        await refresh_product_status(db, vid)


async def release_for_order(
    db: AsyncSession, *, lines: list[LineReservation], order_number: str, actor: User | None = None
) -> None:
    """Undo a reservation (cancel / payment failure). No commit."""
    warehouse_id = await default_warehouse_id(db)
    for line in sorted(lines, key=lambda x: str(x.variant_id)):
        level = await _get_level_for_update(db, line.variant_id, warehouse_id)
        if level is None:
            continue
        level.reserved = max(0, level.reserved - line.quantity)
        db.add(_ledger(
            variant_id=line.variant_id, warehouse_id=warehouse_id,
            movement=StockMovement.release, quantity=-line.quantity,
            ref_type="order", ref_id=order_number, actor=actor,
        ))
    await db.flush()
    for line in lines:
        await refresh_product_status(db, line.variant_id)


async def fulfil_for_order(
    db: AsyncSession, *, lines: list[LineReservation], order_number: str, actor: User | None = None
) -> None:
    """Convert reservation to a permanent deduction (dispatch). No commit.

    For a TRACKED variant (a stock_levels row exists) the dispatch must be
    fully backed: the reservation and on-hand quantity both have to cover the
    line. If either is short we RAISE 409 instead of clamping — silently
    absorbing a shortfall (the old ``min``/``max`` clamp) is exactly what let a
    phantom, unbacked order dispatch and drift the ledger. Raising here lets the
    caller's transaction roll back so an unbacked order fails loudly rather than
    corrupting stock. Untracked variants (no row) pass through as before.
    """
    warehouse_id = await default_warehouse_id(db)
    for line in sorted(lines, key=lambda x: str(x.variant_id)):
        level = await _get_level_for_update(db, line.variant_id, warehouse_id)
        if level is None:
            continue  # untracked variant — nothing to deduct (see B3 policy)
        if level.reserved < line.quantity or level.on_hand < line.quantity:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"cannot fulfil (need {line.quantity}, reserved {level.reserved}, "
                f"on_hand {level.on_hand})",
            )
        level.reserved -= line.quantity
        level.on_hand -= line.quantity
        db.add(_ledger(
            variant_id=line.variant_id, warehouse_id=warehouse_id,
            movement=StockMovement.fulfillment, quantity=-line.quantity,
            ref_type="order", ref_id=order_number, actor=actor,
        ))
    await db.flush()
    for line in lines:
        await refresh_product_status(db, line.variant_id)


# --- Reads --------------------------------------------------------------------


async def list_levels(db: AsyncSession, *, low_only: bool = False) -> list[dict[str, Any]]:
    stmt = (
        select(StockLevel, ProductVariant, Product)
        .join(ProductVariant, ProductVariant.id == StockLevel.variant_id)
        .join(Product, Product.id == ProductVariant.product_id)
        .order_by(Product.name)
    )
    rows = (await db.execute(stmt)).all()
    out = []
    for level, variant, product in rows:
        available = level.on_hand - level.reserved
        if low_only and available > level.reorder_point:
            continue
        out.append({
            "level_id": level.id,
            "variant_id": variant.id,
            "product_id": product.id,
            "product_name": product.name,
            "pack_size": variant.pack_size,
            "on_hand": level.on_hand,
            "reserved": level.reserved,
            "available": available,
            "reorder_point": level.reorder_point,
            "is_low": available <= level.reorder_point,
        })
    return out


async def list_ledger(db: AsyncSession, *, variant_id: uuid.UUID, limit: int = 100) -> list[StockLedger]:
    return list(
        (
            await db.execute(
                select(StockLedger)
                .where(StockLedger.variant_id == variant_id)
                .order_by(StockLedger.created_at.desc())
                .limit(limit)
            )
        ).scalars()
    )


# --- Internals ----------------------------------------------------------------


async def _ensure_variant(db: AsyncSession, variant_id: uuid.UUID) -> None:
    exists = (await db.execute(select(ProductVariant.id).where(ProductVariant.id == variant_id))).scalar_one_or_none()
    if exists is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "variant not found")


async def _reload_level(db: AsyncSession, level_id: uuid.UUID) -> StockLevel:
    from sqlalchemy.orm import selectinload

    return (
        await db.execute(
            select(StockLevel)
            .options(selectinload(StockLevel.variant).selectinload(ProductVariant.product))
            .where(StockLevel.id == level_id)
        )
    ).scalar_one()
