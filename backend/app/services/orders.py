"""Order queries + mutations: list, get, cancel, reorder, track, numbering."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..integrations import razorpay as razorpay_stub
from ..integrations import sms
from ..logging import get_logger
from ..models.audit import AuditLog
from ..models.cart import CartItem
from ..models.order import (
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    PaymentStatus,
    Refund,
    RefundStatus,
)
from ..models.user import User, UserRole
from . import inventory as inventory_svc
from .cart import get_or_create_cart
from .inventory import LineReservation

log = get_logger("services.orders")

# Window during which a customer can self-cancel an order.
CANCELLATION_WINDOW = timedelta(hours=12)


# ---------------------------------------------------------------------------
# Order number generator
# ---------------------------------------------------------------------------
async def next_order_number(db: AsyncSession) -> str:
    """Generate a human-readable order number: NS-YYYY-NNNNN.

    Uses the Postgres sequence `order_number_seq` defined in migration 0003.
    The sequence is non-resetting (simpler than daily reset and still readable).
    """
    seq = (await db.execute(select(func.nextval("order_number_seq")))).scalar_one()
    year = datetime.now(UTC).year
    return f"NS-{year}-{seq:05d}"


# ---------------------------------------------------------------------------
# Read endpoints
# ---------------------------------------------------------------------------
async def list_orders_for_user(
    db: AsyncSession, *, user: User, limit: int = 20, offset: int = 0
) -> tuple[int, list[dict[str, Any]]]:
    base = select(Order).where(Order.user_id == user.id)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    rows_stmt = (
        select(Order, func.count(OrderItem.id))
        .outerjoin(OrderItem, OrderItem.order_id == Order.id)
        .where(Order.user_id == user.id)
        .group_by(Order.id)
        .order_by(Order.placed_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(rows_stmt)).all()

    items = [
        {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status.value,
            "payment_status": order.payment_status.value,
            "payment_method": order.payment_method.value,
            "grand_total": order.grand_total,
            "currency": order.currency,
            "item_count": int(item_count),
            "placed_at": order.placed_at,
        }
        for order, item_count in rows
    ]
    return total, items


async def get_order_for_user(
    db: AsyncSession, *, order_number: str, user: User
) -> dict[str, Any]:
    order = await _load_order_or_404(db, order_number=order_number)
    _ensure_visible_to_user(order, user)
    return _serialise_order_detail(order)


async def cancel_order(
    db: AsyncSession,
    *,
    order_number: str,
    user: User,
    reason: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any]:
    order = await _load_order_or_404(db, order_number=order_number)
    _ensure_visible_to_user(order, user)

    if order.status not in (OrderStatus.placed, OrderStatus.confirmed):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"order is in status '{order.status.value}' and cannot be cancelled",
        )
    if order.placed_at < datetime.now(UTC) - CANCELLATION_WINDOW:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "cancellation window has expired (12 hours after placement)",
        )

    now = datetime.now(UTC)
    order.status = OrderStatus.cancelled
    order.cancelled_at = now
    db.add(
        OrderStatusHistory(
            order_id=order.id,
            status=OrderStatus.cancelled,
            actor_user_id=user.id,
            note=reason or "cancelled by customer",
            at=now,
        )
    )

    # Return reserved stock to the available pool.
    await inventory_svc.release_for_order(
        db,
        lines=[LineReservation(variant_id=it.variant_id, quantity=it.quantity) for it in order.items],
        order_number=order.order_number,
        actor=user,
    )

    # If a captured payment exists, initiate a refund. Stubbed for Phase 3.
    captured = next(
        (p for p in order.payments if p.status == PaymentStatus.captured),
        None,
    )
    if captured is not None:
        refund_resp = razorpay_stub.refund(
            captured.gateway_payment_id or "stub_payment",
            amount_paise=captured.amount,
            notes={"order_number": order.order_number, "reason": reason or ""},
        )
        db.add(
            Refund(
                payment_id=captured.id,
                amount=captured.amount,
                reason=reason,
                status=RefundStatus.processing,
                gateway_refund_id=refund_resp["id"],
                raw_response=refund_resp,
            )
        )
        order.payment_status = PaymentStatus.refunded

    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="order.cancel",
            entity_type="order",
            entity_id=str(order.id),
            payload={"order_number": order.order_number, "reason": reason or ""},
            ip=ip,
            user_agent=user_agent,
        )
    )

    await db.commit()

    # SMS notification (console provider in dev)
    sms.send_order_cancelled(to=user.phone, order_number=order.order_number)
    log.info("order.cancel", order_number=order.order_number, user_id=str(user.id))

    # Reload with relationships so the response is complete.
    fresh = await _load_order_or_404(db, order_number=order.order_number)
    return _serialise_order_detail(fresh)


async def reorder(
    db: AsyncSession,
    *,
    order_number: str,
    user: User,
) -> dict[str, Any]:
    """Copy a past order's items into the user's active cart.

    Returns the resulting cart in serialised form (so the FE can navigate
    straight to /cart).
    """
    order = await _load_order_or_404(db, order_number=order_number)
    _ensure_visible_to_user(order, user)

    cart = await get_or_create_cart(db, user=user)
    # Fold in items; sum quantities for duplicates.
    by_variant = {it.variant_id: it for it in cart.items}
    added = 0
    for line in order.items:
        existing = by_variant.get(line.variant_id)
        if existing is not None:
            existing.quantity += line.quantity
            continue
        db.add(
            CartItem(
                cart_id=cart.id,
                variant_id=line.variant_id,
                quantity=line.quantity,
                # Re-snapshot live price at reorder time so the user can see
                # any drift before checkout.
                unit_price_snapshot=line.unit_price,
                gst_rate_pct_snapshot=line.gst_rate_pct,
                currency_snapshot=order.currency,
            )
        )
        added += 1
    await db.commit()
    log.info("order.reorder", order_number=order.order_number, items_added=added)
    return {"cart_id": str(cart.id), "items_added": added}


async def track_order_public(
    db: AsyncSession, *, order_number: str, phone_last4: str | None
) -> dict[str, Any]:
    """Public tracking — guarded by last-4-digits-of-phone match."""
    order = await _load_order_or_404(db, order_number=order_number)
    # Phase 3: shipping address holds a `phone` field; compare last 4.
    addr_phone = (order.shipping_address or {}).get("phone") or ""
    if phone_last4:
        digits = "".join(ch for ch in addr_phone if ch.isdigit())
        if digits[-4:] != phone_last4:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "phone digits do not match")
    else:
        # Without phone_last4 the caller must be authenticated as the owner.
        # That check is done at the API layer via OptionalUser; the service
        # layer here doesn't see the user. Routing handles this.
        pass

    return {
        "order_number": order.order_number,
        "status": order.status.value,
        "grand_total": order.grand_total,
        "currency": order.currency,
        "item_count": len(order.items),
        "placed_at": order.placed_at,
        "timeline": [
            {"status": e.status.value, "note": e.note, "at": e.at}
            for e in order.status_history
        ],
        "shipment": _serialise_shipment(order.shipment) if order.shipment else None,
    }


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
async def _load_order_or_404(db: AsyncSession, *, order_number: str) -> Order:
    order = (
        await db.execute(
            select(Order)
            .options(
                selectinload(Order.items),
                selectinload(Order.status_history),
                selectinload(Order.payments),
                selectinload(Order.shipment),
            )
            .where(Order.order_number == order_number)
        )
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "order not found")
    return order


def _ensure_visible_to_user(order: Order, user: User) -> None:
    if order.user_id == user.id:
        return
    # Sales/manager/admin can view any order (Phase 5+ will refine to assigned-only).
    if user.role in (UserRole.sales, UserRole.manager, UserRole.admin):
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "order is not visible to you")


def _serialise_order_detail(order: Order) -> dict[str, Any]:
    return {
        "id": order.id,
        "order_number": order.order_number,
        "status": order.status.value,
        "payment_status": order.payment_status.value,
        "payment_method": order.payment_method.value,
        "subtotal": order.subtotal,
        "discount_total": order.discount_total,
        "gst_total": order.gst_total,
        "shipping_total": order.shipping_total,
        "grand_total": order.grand_total,
        "currency": order.currency,
        "shipping_address": order.shipping_address,
        "coupon_code": order.coupon_code,
        "notes": order.notes,
        "placed_at": order.placed_at,
        "confirmed_at": order.confirmed_at,
        "cancelled_at": order.cancelled_at,
        "delivered_at": order.delivered_at,
        "items": [
            {
                "id": it.id,
                "variant_id": it.variant_id,
                "product_name_snapshot": it.product_name_snapshot,
                "brand_snapshot": it.brand_snapshot,
                "unit_label_snapshot": it.unit_label_snapshot,
                "hsn_code_snapshot": it.hsn_code_snapshot,
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "gst_rate_pct": it.gst_rate_pct,
                "gst_amount": it.gst_amount,
                "line_total": it.line_total,
            }
            for it in order.items
        ],
        "status_history": [
            {"status": e.status.value, "note": e.note, "at": e.at}
            for e in order.status_history
        ],
        "payments": [
            {
                "method": p.method.value,
                "status": p.status.value,
                "amount": p.amount,
                "currency": p.currency,
                "gateway": p.gateway,
                "gateway_payment_id": p.gateway_payment_id,
                "captured_at": p.captured_at,
                "failed_at": p.failed_at,
            }
            for p in order.payments
        ],
        "shipment": _serialise_shipment(order.shipment) if order.shipment else None,
    }


def _serialise_shipment(shipment) -> dict[str, Any]:
    return {
        "status": shipment.status.value,
        "courier": shipment.courier,
        "awb_number": shipment.awb_number,
        "tracking_url": shipment.tracking_url,
        "dispatched_at": shipment.dispatched_at,
        "delivered_at": shipment.delivered_at,
        "eta": shipment.eta,
    }
