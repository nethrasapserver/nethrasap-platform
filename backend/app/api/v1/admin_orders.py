"""Staff order fulfilment — shipments (orders:fulfil), refunds (orders:refund)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ...db import DbSession
from ...deps import require_permission
from ...models.user import User
from ...schemas.order import OrderDetail
from ...services import fulfilment as svc
from ...services import orders as orders_svc

router = APIRouter()

FulfilStaff = Annotated[User, Depends(require_permission("orders:fulfil"))]
RefundStaff = Annotated[User, Depends(require_permission("orders:refund"))]


@router.get("/admin/orders")
async def list_orders_admin(
    db: DbSession,
    actor: FulfilStaff,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    payment_status: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=80, description="order no. / phone / name")] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    """All customer orders for the ops queue — filterable and paginated."""
    total, items = await orders_svc.list_orders_admin(
        db,
        status_filter=status_filter,
        payment_filter=payment_status,
        q=q,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return {"total": total, "items": items}


class ShipmentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    courier: str = Field(min_length=1, max_length=80)
    awb_number: str = Field(min_length=1, max_length=64)
    tracking_url: str | None = Field(default=None, max_length=512)
    eta: datetime | None = None


class ShipmentStatusUpdate(BaseModel):
    status: Literal["in_transit", "out_for_delivery", "delivered", "returned"]


class RefundRequest(BaseModel):
    amount_paise: int | None = Field(default=None, gt=0, description="omit for full refund")
    reason: str | None = Field(default=None, max_length=500)


class CodCollectRequest(BaseModel):
    note: str | None = Field(default=None, max_length=500)


@router.post("/admin/orders/{order_number}/shipment", response_model=OrderDetail)
async def create_shipment(
    order_number: str, payload: ShipmentCreate, db: DbSession, actor: FulfilStaff
) -> OrderDetail:
    data = await svc.create_shipment(
        db,
        actor,
        order_number=order_number,
        courier=payload.courier,
        awb_number=payload.awb_number,
        tracking_url=payload.tracking_url,
        eta=payload.eta,
    )
    return OrderDetail.model_validate(data)


@router.patch("/admin/orders/{order_number}/shipment", response_model=OrderDetail)
async def update_shipment(
    order_number: str, payload: ShipmentStatusUpdate, db: DbSession, actor: FulfilStaff
) -> OrderDetail:
    data = await svc.update_shipment_status(db, actor, order_number=order_number, new_status=payload.status)
    return OrderDetail.model_validate(data)


@router.post("/admin/orders/{order_number}/refund", response_model=OrderDetail)
async def refund(
    order_number: str, payload: RefundRequest, db: DbSession, actor: RefundStaff
) -> OrderDetail:
    data = await svc.refund_order(
        db, actor, order_number=order_number, amount_paise=payload.amount_paise, reason=payload.reason
    )
    return OrderDetail.model_validate(data)


@router.post("/admin/orders/{order_number}/cod-collected", response_model=OrderDetail)
async def mark_cod_collected(
    order_number: str, payload: CodCollectRequest, db: DbSession, actor: FulfilStaff
) -> OrderDetail:
    """H-5: record COD cash collected — captures the payment (idempotent) and
    unlocks the refund path. Gated on orders:fulfil: collecting cash is a
    delivery/ops action (sales/manager/admin); refunds stay orders:refund."""
    data = await svc.mark_cod_collected(
        db, actor, order_number=order_number, note=payload.note
    )
    return OrderDetail.model_validate(data)
