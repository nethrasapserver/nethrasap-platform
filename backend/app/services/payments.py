"""Payment confirmation — the single place a gateway capture or failure lands.

Two entry points converge here:
  * `POST /payments/webhook`  — Razorpay → us (production truth).
  * `POST /checkout/confirm`  — client handshake (dev + fallback when the
    webhook can't reach us).

Both resolve a Payment row and call `apply_captured` / `apply_failed`, which
are idempotent on the payment's current status — a webhook + client-confirm
race, or a webhook retry, transitions the order exactly once.
"""
from __future__ import annotations

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
)
from ..realtime import publish_event
from ..realtime.channels import role_channel, user_channel
from .inventory import LineReservation, release_for_order

log = get_logger("services.payments")


async def _payment_by_order_id(db: AsyncSession, gateway_order_id: str) -> Payment | None:
    return (
        await db.execute(
            select(Payment)
            .options(selectinload(Payment.order).selectinload(Order.items))
            .where(Payment.gateway_order_id == gateway_order_id)
        )
    ).scalar_one_or_none()


async def apply_captured(
    db: AsyncSession, *, payment: Payment, gateway_payment_id: str, raw: dict[str, Any]
) -> bool:
    """Mark a payment captured and confirm its order. Returns True if this call
    performed the transition (False if it was already captured)."""
    if payment.status == PaymentStatus.captured:
        return False

    now = datetime.now(UTC)
    order = payment.order
    payment.status = PaymentStatus.captured
    payment.gateway_payment_id = gateway_payment_id
    payment.captured_at = now
    payment.raw_response = raw

    if order.status == OrderStatus.placed:
        order.status = OrderStatus.confirmed
        order.confirmed_at = now
    order.payment_status = PaymentStatus.captured
    db.add(
        OrderStatusHistory(
            order_id=order.id,
            status=OrderStatus.confirmed,
            note="payment captured",
            at=now,
        )
    )
    db.add(
        AuditLog(
            actor_user_id=order.user_id,
            action="payment.captured",
            entity_type="order",
            entity_id=str(order.id),
            payload={"order_number": order.order_number, "amount": payment.amount},
        )
    )
    await db.commit()

    await _notify(order, type="order.confirmed", extra={"payment_status": "captured"})
    sms.send_order_confirmation(
        to=_order_phone(order), order_number=order.order_number, grand_total_paise=order.grand_total
    )
    # PDF invoice generation runs off the request path.
    await _enqueue_invoice(order.order_number)
    log.info("payment.captured", order_number=order.order_number)
    return True


async def apply_failed(db: AsyncSession, *, payment: Payment, raw: dict[str, Any]) -> bool:
    """Mark a payment failed, fail the order, and release reserved stock."""
    if payment.status in (PaymentStatus.failed, PaymentStatus.captured):
        return False

    now = datetime.now(UTC)
    order = payment.order
    payment.status = PaymentStatus.failed
    payment.failed_at = now
    payment.raw_response = raw
    order.status = OrderStatus.payment_failed
    order.payment_status = PaymentStatus.failed
    db.add(
        OrderStatusHistory(
            order_id=order.id, status=OrderStatus.payment_failed, note="payment failed", at=now
        )
    )

    await release_for_order(
        db,
        lines=[LineReservation(variant_id=it.variant_id, quantity=it.quantity) for it in order.items],
        order_number=order.order_number,
    )
    db.add(
        AuditLog(
            actor_user_id=order.user_id,
            action="payment.failed",
            entity_type="order",
            entity_id=str(order.id),
            payload={"order_number": order.order_number},
        )
    )
    await db.commit()
    await _notify(order, type="order.payment_failed", extra={"payment_status": "failed"})
    log.info("payment.failed", order_number=order.order_number)
    return True


# --- Entry points -------------------------------------------------------------


async def confirm_from_client(
    db: AsyncSession, *, gateway_order_id: str, gateway_payment_id: str, signature: str
) -> dict[str, Any]:
    """Client-side handshake from the Razorpay Checkout modal."""
    if not razorpay.verify_checkout_signature(
        order_id=gateway_order_id, payment_id=gateway_payment_id, signature=signature
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid payment signature")

    payment = await _payment_by_order_id(db, gateway_order_id)
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown gateway order")
    await apply_captured(
        db,
        payment=payment,
        gateway_payment_id=gateway_payment_id,
        raw={"source": "client_confirm", "payment_id": gateway_payment_id},
    )
    return {"order_number": payment.order.order_number, "status": payment.order.status.value}


async def handle_webhook(db: AsyncSession, *, event: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Process a verified Razorpay webhook. Idempotent per payment status."""
    entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    gateway_order_id = entity.get("order_id")
    gateway_payment_id = entity.get("id")
    if not gateway_order_id:
        return {"ignored": True, "reason": "no order_id in payload"}

    payment = await _payment_by_order_id(db, gateway_order_id)
    if payment is None:
        return {"ignored": True, "reason": "unknown order"}

    if event == "payment.captured":
        changed = await apply_captured(
            db, payment=payment, gateway_payment_id=gateway_payment_id or "", raw=entity
        )
    elif event == "payment.failed":
        changed = await apply_failed(db, payment=payment, raw=entity)
    else:
        return {"ignored": True, "reason": f"unhandled event {event}"}
    return {"processed": changed, "order_number": payment.order.order_number}


# --- Helpers ------------------------------------------------------------------


async def _notify(order: Order, *, type: str, extra: dict[str, Any]) -> None:
    payload = {"order_number": order.order_number, "status": order.status.value, **extra}
    await publish_event(
        [user_channel(str(order.user_id)), role_channel("sales")],
        type=type,
        entity="order",
        entity_id=order.order_number,
        payload=payload,
    )


def _order_phone(order: Order) -> str:
    addr = order.shipping_address or {}
    return addr.get("phone") or ""


async def _enqueue_invoice(order_number: str) -> None:
    from ..worker import enqueue_job

    await enqueue_job("generate_invoice_pdf", order_number=order_number)
