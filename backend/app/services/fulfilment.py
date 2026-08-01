"""Staff fulfilment — shipments, the dispatch→delivered status walk, refunds.

Dispatch is where reserved stock becomes a permanent deduction (B3's
`fulfil_for_order`). Every transition appends order_status_history (feeding the
customer tracking timeline) and notifies over SMS + WebSocket.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..integrations import razorpay, sms
from ..logging import get_logger
from ..models.audit import AuditLog
from ..models.order import (
    Order,
    OrderStatus,
    OrderStatusHistory,
    Payment,
    PaymentStatus,
    Refund,
    RefundStatus,
    Shipment,
    ShipmentStatus,
)
from ..models.user import User
from ..realtime import publish_event
from ..realtime.channels import role_channel, user_channel
from . import outbox
from .inventory import LineReservation, fulfil_for_order

log = get_logger("services.fulfilment")

# Which order status each shipment status implies.
_SHIPMENT_TO_ORDER = {
    ShipmentStatus.in_transit: OrderStatus.dispatched,
    ShipmentStatus.out_for_delivery: OrderStatus.out_for_delivery,
    ShipmentStatus.delivered: OrderStatus.delivered,
}


async def _load(db: AsyncSession, order_number: str) -> Order:
    order = (
        await db.execute(
            select(Order)
            .options(
                selectinload(Order.items),
                selectinload(Order.shipment),
                selectinload(Order.payments),
                selectinload(Order.status_history),
            )
            .where(Order.order_number == order_number)
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "order not found")
    return order


async def _notify(order: Order, *, type: str, note: str) -> None:
    await publish_event(
        [user_channel(str(order.user_id)), role_channel("sales")],
        type=type,
        entity="order",
        entity_id=order.order_number,
        payload={"order_number": order.order_number, "status": order.status.value, "note": note},
    )


def _phone(order: Order) -> str:
    return (order.shipping_address or {}).get("phone") or ""


# --- Shipments ----------------------------------------------------------------


async def create_shipment(
    db: AsyncSession,
    actor: User,
    *,
    order_number: str,
    courier: str,
    awb_number: str,
    tracking_url: str | None,
    eta: datetime | None,
) -> dict[str, Any]:
    order = await _load(db, order_number)
    if order.status not in (OrderStatus.confirmed, OrderStatus.packed):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"order in status '{order.status.value}' cannot be dispatched",
        )
    if order.shipment is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "shipment already exists")

    now = datetime.now(UTC)
    db.add(
        Shipment(
            order_id=order.id,
            status=ShipmentStatus.in_transit,
            courier=courier,
            awb_number=awb_number,
            tracking_url=tracking_url,
            dispatched_at=now,
            eta=eta,
        )
    )
    order.status = OrderStatus.dispatched
    db.add(
        OrderStatusHistory(
            order_id=order.id,
            status=OrderStatus.dispatched,
            actor_user_id=actor.id,
            note=f"dispatched via {courier} ({awb_number})",
            at=now,
        )
    )

    # Reserved → permanent deduction.
    await fulfil_for_order(
        db,
        lines=[LineReservation(variant_id=it.variant_id, quantity=it.quantity) for it in order.items],
        order_number=order.order_number,
        actor=actor,
    )
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="order.dispatched",
            entity_type="order",
            entity_id=str(order.id),
            payload={"order_number": order.order_number, "courier": courier, "awb": awb_number},
        )
    )
    await db.commit()
    await _notify(order, type="order.dispatched", note=f"dispatched via {courier}")
    sms.send_sms(
        to=_phone(order),
        body=f"Nethrasap: order {order.order_number} dispatched via {courier}. AWB {awb_number}.",
    )
    log.info("order.dispatched", order_number=order_number, courier=courier)
    return await _detail(db, order_number)


async def update_shipment_status(
    db: AsyncSession, actor: User, *, order_number: str, new_status: str
) -> dict[str, Any]:
    order = await _load(db, order_number)
    if order.shipment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no shipment to update")
    try:
        ship_status = ShipmentStatus(new_status)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid status: {new_status}") from None

    now = datetime.now(UTC)
    order.shipment.status = ship_status
    order_status = _SHIPMENT_TO_ORDER.get(ship_status)
    if order_status is not None:
        order.status = order_status
        db.add(
            OrderStatusHistory(
                order_id=order.id,
                status=order_status,
                actor_user_id=actor.id,
                note=f"shipment {ship_status.value}",
                at=now,
            )
        )
    if ship_status == ShipmentStatus.delivered:
        order.shipment.delivered_at = now
        order.delivered_at = now
        # COD orders have no payment-capture moment, so delivery is when the
        # sale completes — issue the tax invoice now (prepaid orders already
        # got theirs at capture; generate_for_order is idempotent either way).
        # Recorded in the same transaction (transactional outbox) so a crash
        # after commit can't lose it.
        await outbox.enqueue_via_outbox(db, "generate_invoice_pdf", order_number=order.order_number)

    await db.commit()
    if ship_status == ShipmentStatus.delivered:
        await outbox.dispatch_pending(db)  # best-effort; worker sweep is the backstop
    await _notify(order, type="order.status_changed", note=f"shipment {ship_status.value}")
    if ship_status == ShipmentStatus.delivered:
        sms.send_sms(to=_phone(order), body=f"Nethrasap: order {order.order_number} delivered. Thank you!")
    return await _detail(db, order_number)


# --- Refunds ------------------------------------------------------------------


async def refund_order(
    db: AsyncSession,
    actor: User,
    *,
    order_number: str,
    amount_paise: int | None,
    reason: str | None,
) -> dict[str, Any]:
    order = await _load(db, order_number)
    # A partially-refunded payment is still refundable up to its remaining balance.
    captured = next(
        (p for p in order.payments if p.status in (PaymentStatus.captured, PaymentStatus.partial_refund)),
        None,
    )
    if captured is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "no captured payment to refund")

    # CR-1: lock the payment row FIRST so concurrent refunds serialize. A second
    # refund blocks here until the first commits, then recomputes the refunded
    # total under the lock — seeing the first refund row — and correctly bounds
    # (or rejects) itself. Without this, parallel refunds each read a stale
    # total and over-refund real money at the gateway.
    (
        await db.execute(
            select(Payment).where(Payment.id == captured.id).with_for_update()
        )
    ).scalar_one()

    already_refunded = await _refunded_total(db, captured.id)
    refundable = captured.amount - already_refunded
    amount = amount_paise if amount_paise is not None else refundable
    if amount <= 0 or amount > refundable:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"refund amount must be 1..{refundable} paise")

    # Gateway call happens only after the row is locked and the bound re-checked,
    # so a losing concurrent refund never reaches the gateway.
    resp = await razorpay.refund(
        captured.gateway_payment_id or "stub_payment",
        amount_paise=amount,
        notes={"order_number": order.order_number, "reason": reason or ""},
    )
    now = datetime.now(UTC)
    db.add(
        Refund(
            payment_id=captured.id,
            amount=amount,
            reason=reason,
            status=RefundStatus.processing,
            gateway_refund_id=resp["id"],
            raw_response=resp,
            processed_at=now,
        )
    )

    is_full = (already_refunded + amount) >= captured.amount
    captured.status = PaymentStatus.refunded if is_full else PaymentStatus.partial_refund
    order.payment_status = captured.status
    if is_full:
        order.status = OrderStatus.refunded
        db.add(
            OrderStatusHistory(
                order_id=order.id,
                status=OrderStatus.refunded,
                actor_user_id=actor.id,
                note=reason or "refunded",
                at=now,
            )
        )
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="order.refunded",
            entity_type="order",
            entity_id=str(order.id),
            payload={"order_number": order.order_number, "amount": amount, "full": is_full},
        )
    )
    await db.commit()
    await _notify(order, type="order.refunded", note=f"refund {amount} paise")
    sms.send_sms(
        to=_phone(order),
        body=f"Nethrasap: refund of Rs {amount / 100:,.2f} initiated for order {order.order_number}.",
    )
    log.info("order.refunded", order_number=order_number, amount=amount, full=is_full)
    return await _detail(db, order_number)


async def _refunded_total(db: AsyncSession, payment_id: uuid.UUID) -> int:
    rows = (await db.execute(select(Refund.amount).where(Refund.payment_id == payment_id))).scalars()
    return sum(rows)


async def _detail(db: AsyncSession, order_number: str) -> dict[str, Any]:
    from .orders import _load_order_or_404, _serialise_order_detail

    return _serialise_order_detail(await _load_order_or_404(db, order_number=order_number))
