"""Checkout — quote totals and place an order from a cart.

Phase 3 supports two payment paths end-to-end:
  * COD (`payment_method = 'cod'`) — order is placed in `confirmed` status
    and `payment_status = 'cod_pending'`. No gateway handshake.
  * UPI / Card / Netbanking / Wallet — the order is placed in `placed`
    status with `payment_status = 'pending'`. A Razorpay-shaped
    `gateway_order_id` is generated via the STUB `integrations/razorpay.py`
    so the frontend's modal-payment flow has a shape to consume; once real
    Razorpay is wired up in a later phase, only the stub gets swapped.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..integrations import razorpay as razorpay_stub
from ..integrations import sms
from ..logging import get_logger
from ..models.audit import AuditLog
from ..models.cart import Cart
from ..models.catalogue import (
    PriceRole,
    Product,
    ProductVariant,
)
from ..models.order import (
    Invoice,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    Payment,
    PaymentMethod,
    PaymentStatus,
)
from ..models.user import User
from ..services import inventory as inventory_svc
from ..services.inventory import LineReservation
from . import pricing
from .cart import clear_cart_items
from .catalogue import _price_role_for_user
from .orders import next_order_number

log = get_logger("services.checkout")


# ---------------------------------------------------------------------------
# Quote — no DB writes
# ---------------------------------------------------------------------------
async def quote(
    db: AsyncSession,
    *,
    cart: Cart,
    payment_method: str,
    user: User | None,
) -> dict[str, Any]:
    """Compute totals against the live catalogue. Surfaces price drift."""
    if not cart.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cart is empty")
    if payment_method not in {"cod", "upi", "card", "netbanking", "wallet"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid payment_method: {payment_method}")

    variant_ids = [it.variant_id for it in cart.items]
    rows = (
        await db.execute(
            select(ProductVariant)
            .options(
                selectinload(ProductVariant.product).selectinload(Product.category),
                selectinload(ProductVariant.prices),
            )
            .where(ProductVariant.id.in_(variant_ids))
        )
    ).scalars().all()
    variants_by_id = {v.id: v for v in rows}

    price_role = _price_role_for_user(user)

    subtotal = 0
    gst_total = 0
    has_cold_chain = False
    price_changes: list[str] = []

    for it in cart.items:
        variant = variants_by_id.get(it.variant_id)
        if variant is None or not variant.product.is_active:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"item is no longer available (variant {it.variant_id})",
            )
        live_price = _resolve_live_price(variant, price_role)
        if live_price != it.unit_price_snapshot:
            price_changes.append(
                f"{variant.product.name}: ₹{it.unit_price_snapshot / 100:,.0f}"
                f" → ₹{live_price / 100:,.0f}"
            )

        line = pricing.compute_line(
            quantity=it.quantity,
            unit_price=live_price,
            gst_rate_pct=variant.product.gst_rate_pct,
        )
        subtotal += line.subtotal
        gst_total += line.gst_amount
        if variant.product.category and variant.product.category.slug == "cold-chain":
            has_cold_chain = True

    discount = pricing.coupon_discount(cart.coupon, subtotal)
    eligible, reason = pricing.is_coupon_eligible(cart.coupon, subtotal)
    if cart.coupon is not None and not eligible:
        # The cart's saved coupon doesn't apply at checkout time.
        discount = 0
        price_changes.append(f"coupon {cart.coupon.code} no longer applies: {reason}")

    shipping = pricing.shipping_for(
        subtotal_after_discount=subtotal - discount,
        has_cold_chain=has_cold_chain,
    )
    grand_total = max(0, subtotal - discount + gst_total + shipping)

    return {
        "totals": {
            "subtotal": subtotal,
            "discount": discount,
            "gst": gst_total,
            "shipping": shipping,
            "grand_total": grand_total,
            "currency": "INR",
        },
        "payment_method": payment_method,
        "cold_chain": has_cold_chain,
        "notes": [],
        "price_changes": price_changes,
    }


# ---------------------------------------------------------------------------
# Place — single transaction, idempotent on `client_request_id`
# ---------------------------------------------------------------------------
async def place_order(
    db: AsyncSession,
    *,
    cart: Cart,
    user: User,
    address: dict[str, Any],
    payment_method: str,
    client_request_id: str,
    notes: str | None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any]:
    # Idempotency FIRST: a retry with the same request id must replay the
    # existing order even though the first attempt already emptied the cart.
    existing = (
        await db.execute(
            select(Order)
            .options(selectinload(Order.payments))
            .where(Order.client_request_id == client_request_id)
        )
    ).scalar_one_or_none()
    if existing is not None:
        return _build_place_response(existing, gateway_handshake=_gateway_for(existing))

    if not cart.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cart is empty")

    # Recompute totals against live prices.
    q = await quote(db, cart=cart, payment_method=payment_method, user=user)
    totals = q["totals"]

    # Build the order row.
    now = datetime.now(UTC)
    order_number = await next_order_number(db)

    is_cod = payment_method == "cod"
    order_status = OrderStatus.confirmed if is_cod else OrderStatus.placed
    payment_status = PaymentStatus.cod_pending if is_cod else PaymentStatus.pending

    order = Order(
        order_number=order_number,
        user_id=user.id,
        status=order_status,
        subtotal=totals["subtotal"],
        discount_total=totals["discount"],
        gst_total=totals["gst"],
        shipping_total=totals["shipping"],
        grand_total=totals["grand_total"],
        currency="INR",
        shipping_address=address,
        payment_method=PaymentMethod(payment_method),
        payment_status=payment_status,
        coupon_code=cart.coupon.code if cart.coupon and totals["discount"] > 0 else None,
        notes=notes,
        client_request_id=client_request_id,
        placed_at=now,
        confirmed_at=now if is_cod else None,
    )
    db.add(order)
    await db.flush()

    # Items — snapshot every render-critical field.
    variant_ids = [it.variant_id for it in cart.items]
    variants = (
        await db.execute(
            select(ProductVariant)
            .options(
                selectinload(ProductVariant.product),
                selectinload(ProductVariant.prices),
            )
            .where(ProductVariant.id.in_(variant_ids))
        )
    ).scalars().all()
    variants_by_id = {v.id: v for v in variants}
    price_role = _price_role_for_user(user)

    for it in cart.items:
        v = variants_by_id[it.variant_id]
        live_price = _resolve_live_price(v, price_role)
        line = pricing.compute_line(
            quantity=it.quantity,
            unit_price=live_price,
            gst_rate_pct=v.product.gst_rate_pct,
        )
        db.add(
            OrderItem(
                order_id=order.id,
                variant_id=v.id,
                product_name_snapshot=v.product.name,
                brand_snapshot=v.product.brand,
                unit_label_snapshot=v.unit_label,
                hsn_code_snapshot=v.product.hsn_code,
                quantity=it.quantity,
                unit_price=line.unit_price,
                gst_rate_pct=line.gst_rate_pct,
                gst_amount=line.gst_amount,
                line_total=line.line_total,
            )
        )

    # Reserve stock for tracked variants (409 if any is short). Runs in this
    # same transaction so a reservation failure rolls the whole order back.
    await inventory_svc.reserve_for_order(
        db,
        lines=[LineReservation(variant_id=it.variant_id, quantity=it.quantity) for it in cart.items],
        order_number=order.order_number,
        actor=user,
    )

    # Status history first event.
    db.add(
        OrderStatusHistory(
            order_id=order.id,
            status=order_status,
            actor_user_id=user.id,
            note="Order placed" + (" (COD)" if is_cod else ""),
            at=now,
        )
    )

    # Payment row + gateway handshake (stub for non-COD).
    gateway_handshake: dict[str, Any] | None = None
    if is_cod:
        db.add(
            Payment(
                order_id=order.id,
                method=PaymentMethod.cod,
                status=PaymentStatus.cod_pending,
                amount=totals["grand_total"],
                currency="INR",
                gateway="cod",
            )
        )
    else:
        rzp = razorpay_stub.create_order(
            amount_paise=totals["grand_total"],
            receipt=order.order_number,
            notes={"order_number": order.order_number, "user_phone": user.phone},
        )
        db.add(
            Payment(
                order_id=order.id,
                method=PaymentMethod(payment_method),
                status=PaymentStatus.pending,
                amount=totals["grand_total"],
                currency="INR",
                gateway="razorpay-stub",
                gateway_order_id=rzp["id"],
                raw_response=rzp,
            )
        )
        gateway_handshake = {
            "gateway": "razorpay-stub",
            "gateway_key_id": None,  # set when real Razorpay lands
            "gateway_order_id": rzp["id"],
            "amount": totals["grand_total"],
            "currency": "INR",
        }

    # Invoice row created at order time; PDF generation deferred (stub).
    db.add(
        Invoice(
            order_id=order.id,
            invoice_number=order.order_number,  # 1:1 for Phase 3
        )
    )

    # Bump coupon usage counter.
    if cart.coupon and totals["discount"] > 0:
        cart.coupon.used_count = (cart.coupon.used_count or 0) + 1

    # Clear the cart (items + coupon) — order has snapshotted everything.
    await clear_cart_items(db, cart=cart)

    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="order.placed",
            entity_type="order",
            entity_id=str(order.id),
            payload={
                "order_number": order.order_number,
                "grand_total": totals["grand_total"],
                "payment_method": payment_method,
            },
            ip=ip,
            user_agent=user_agent,
        )
    )

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        # Most likely a duplicate `client_request_id` race — fetch & return.
        retry = (
            await db.execute(
                select(Order).where(Order.client_request_id == client_request_id)
            )
        ).scalar_one_or_none()
        if retry is not None:
            return _build_place_response(retry, gateway_handshake=_gateway_for(retry))
        raise HTTPException(status.HTTP_409_CONFLICT, "could not place order") from e

    # Fire-and-forget SMS notification (console provider in dev).
    sms.send_order_confirmation(
        to=user.phone,
        order_number=order.order_number,
        grand_total_paise=totals["grand_total"],
    )

    log.info(
        "order.placed",
        order_number=order.order_number,
        user_id=str(user.id),
        payment_method=payment_method,
        grand_total=totals["grand_total"],
    )
    return _build_place_response(order, gateway_handshake=gateway_handshake)


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
def _resolve_live_price(variant: ProductVariant, role: PriceRole) -> int:
    active = next(
        (p for p in variant.prices if p.role == role and p.valid_to is None),
        None,
    )
    if active is None:
        active = next(
            (p for p in variant.prices if p.role == PriceRole.customer and p.valid_to is None),
            None,
        )
    if active is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"price unavailable for variant {variant.id}",
        )
    return active.selling_price


def _gateway_for(order: Order) -> dict[str, Any] | None:
    """Best-effort reconstruction of the gateway handshake for an existing
    (idempotent-retry) order."""
    if not order.payments:
        return None
    p = next((pp for pp in order.payments if pp.gateway and pp.gateway != "cod"), None)
    if p is None:
        return None
    return {
        "gateway": p.gateway,
        "gateway_key_id": None,
        "gateway_order_id": p.gateway_order_id,
        "amount": p.amount,
        "currency": p.currency,
    }


def _build_place_response(order: Order, *, gateway_handshake: dict | None) -> dict[str, Any]:
    return {
        "order_number": order.order_number,
        "status": order.status.value,
        "payment_status": order.payment_status.value,
        "grand_total": order.grand_total,
        "currency": order.currency,
        "gateway": gateway_handshake,
    }
