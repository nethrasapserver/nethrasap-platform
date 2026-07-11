"""Orders endpoints — list, detail, cancel, reorder, track."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from ...db import DbSession
from ...deps import ClientMeta, CurrentUser, OptionalUser, Paged
from ...schemas.common import Paginated
from ...schemas.order import (
    CancelOrderRequest,
    OrderDetail,
    OrderListItem,
    TrackOrderPublic,
)
from ...services import orders as svc

router = APIRouter()


@router.get("", response_model=Paginated[OrderListItem])
async def list_orders(
    db: DbSession, user: CurrentUser, pagination: Paged
) -> Paginated[OrderListItem]:
    total, items = await svc.list_orders_for_user(
        db, user=user, limit=pagination.limit, offset=pagination.offset
    )
    return Paginated[OrderListItem](
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        items=[OrderListItem.model_validate(i) for i in items],
    )


@router.get("/{order_number}", response_model=OrderDetail)
async def get_order(order_number: str, db: DbSession, user: CurrentUser) -> OrderDetail:
    data = await svc.get_order_for_user(db, order_number=order_number, user=user)
    return OrderDetail.model_validate(data)


@router.post("/{order_number}/cancel", response_model=OrderDetail)
async def cancel_order(
    order_number: str,
    payload: CancelOrderRequest,
    db: DbSession,
    user: CurrentUser,
    meta: ClientMeta,
) -> OrderDetail:
    data = await svc.cancel_order(
        db,
        order_number=order_number,
        user=user,
        reason=payload.reason,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
    )
    return OrderDetail.model_validate(data)


@router.post("/{order_number}/reorder")
async def reorder(order_number: str, db: DbSession, user: CurrentUser) -> dict:
    return await svc.reorder(db, order_number=order_number, user=user)


@router.get("/{order_number}/track", response_model=TrackOrderPublic)
async def track_order(
    order_number: str,
    db: DbSession,
    user: OptionalUser,
    phone_last4: Annotated[str | None, Query(min_length=4, max_length=4)] = None,
) -> TrackOrderPublic:
    # If the caller is signed in and owns the order, skip the phone check.
    if user is not None:
        try:
            data = await svc.get_order_for_user(db, order_number=order_number, user=user)
            return TrackOrderPublic(
                order_number=data["order_number"],
                status=data["status"],
                grand_total=data["grand_total"],
                currency=data["currency"],
                item_count=len(data["items"]),
                placed_at=data["placed_at"],
                timeline=data["status_history"],
                shipment=data["shipment"],
            )
        except Exception:
            # Fall through to public tracking path
            pass
    data = await svc.track_order_public(
        db, order_number=order_number, phone_last4=phone_last4
    )
    return TrackOrderPublic.model_validate(data)
