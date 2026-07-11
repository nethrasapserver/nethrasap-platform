"""Admin inventory endpoints — behind `inventory:write`."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

from ...db import DbSession
from ...deps import require_permission
from ...models.inventory import Warehouse
from ...models.user import User
from ...schemas.inventory import (
    AdjustRequest,
    LedgerEntryOut,
    ReceiveRequest,
    StockLevelOut,
    WarehouseCreate,
    WarehouseOut,
)
from ...services import inventory as svc

router = APIRouter()

InventoryAdmin = Annotated[User, Depends(require_permission("inventory:write"))]


@router.get("/admin/inventory", response_model=list[StockLevelOut])
async def list_inventory(
    db: DbSession,
    _a: InventoryAdmin,
    low_only: Annotated[bool, Query()] = False,
) -> list[StockLevelOut]:
    return [StockLevelOut(**row) for row in await svc.list_levels(db, low_only=low_only)]


@router.post("/admin/inventory/receive", response_model=StockLevelOut, status_code=status.HTTP_201_CREATED)
async def receive(payload: ReceiveRequest, db: DbSession, actor: InventoryAdmin) -> StockLevelOut:
    level = await svc.receive_stock(
        db,
        actor,
        variant_id=payload.variant_id,
        warehouse_id=payload.warehouse_id,
        quantity=payload.quantity,
        reorder_point=payload.reorder_point,
        note=payload.note,
    )
    return _level_out(level)


@router.post("/admin/inventory/adjust", response_model=StockLevelOut)
async def adjust(payload: AdjustRequest, db: DbSession, actor: InventoryAdmin) -> StockLevelOut:
    level = await svc.adjust_stock(
        db,
        actor,
        variant_id=payload.variant_id,
        warehouse_id=payload.warehouse_id,
        delta=payload.delta,
        reason=payload.reason,
        note=payload.note,
    )
    return _level_out(level)


@router.get("/admin/inventory/ledger", response_model=list[LedgerEntryOut])
async def ledger(
    db: DbSession,
    _a: InventoryAdmin,
    variant_id: Annotated[UUID, Query()],
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[LedgerEntryOut]:
    return [LedgerEntryOut.model_validate(e) for e in await svc.list_ledger(db, variant_id=variant_id, limit=limit)]


@router.get("/admin/warehouses", response_model=list[WarehouseOut])
async def list_warehouses(db: DbSession, _a: InventoryAdmin) -> list[WarehouseOut]:
    rows = (await db.execute(select(Warehouse).order_by(Warehouse.code))).scalars()
    return [WarehouseOut.model_validate(w) for w in rows]


@router.post("/admin/warehouses", response_model=WarehouseOut, status_code=status.HTTP_201_CREATED)
async def create_warehouse(payload: WarehouseCreate, db: DbSession, _a: InventoryAdmin) -> WarehouseOut:
    from fastapi import HTTPException

    dup = (await db.execute(select(Warehouse.id).where(Warehouse.code == payload.code))).scalar_one_or_none()
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT, f"warehouse code exists: {payload.code}")
    wh = Warehouse(**payload.model_dump())
    db.add(wh)
    await db.commit()
    return WarehouseOut.model_validate(wh)


def _level_out(level) -> StockLevelOut:
    # Build the enriched row the same shape list_levels emits.
    available = level.on_hand - level.reserved
    return StockLevelOut(
        level_id=level.id,
        variant_id=level.variant_id,
        product_id=level.variant.product_id,
        product_name=level.variant.product.name,
        pack_size=level.variant.pack_size,
        on_hand=level.on_hand,
        reserved=level.reserved,
        available=available,
        reorder_point=level.reorder_point,
        is_low=available <= level.reorder_point,
    )
