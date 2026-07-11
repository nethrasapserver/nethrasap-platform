"""Enquiries (RFQ) — customer creates, sales prices, converts to an order.

State machine (enforced by _require_status):
  pending → quoted → confirmed → converted
       ↘ rejected     ↘ rejected
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..logging import get_logger
from ..models.audit import AuditLog
from ..models.catalogue import ProductVariant
from ..models.enquiry import (
    Enquiry,
    EnquiryItem,
    EnquiryMessage,
    EnquiryStatus,
    EnquiryStatusHistory,
)
from ..models.user import User, UserRole
from ..realtime import publish_event
from ..realtime.channels import role_channel, user_channel
from . import notifications as notify_svc
from .notifications import NotificationType

log = get_logger("services.enquiries")

QUOTE_VALIDITY = timedelta(days=7)


async def _reference(db: AsyncSession) -> str:
    year = datetime.now(UTC).year
    n = (
        await db.execute(select(func.count(Enquiry.id)).where(Enquiry.reference.like(f"ENQ-{year}-%")))
    ).scalar_one()
    return f"ENQ-{year}-{n + 1:05d}"


async def _load(db: AsyncSession, enquiry_id: uuid.UUID) -> Enquiry:
    enq = (
        await db.execute(
            select(Enquiry).where(Enquiry.id == enquiry_id).execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if enq is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "enquiry not found")
    return enq


def _ensure_visible(enq: Enquiry, user: User) -> None:
    if enq.customer_id == user.id:
        return
    if user.role in (UserRole.sales, UserRole.manager, UserRole.admin):
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "enquiry not visible to you")


def _history(enq: Enquiry, actor: User | None, note: str | None) -> EnquiryStatusHistory:
    return EnquiryStatusHistory(
        enquiry_id=enq.id,
        status=enq.status,
        actor_user_id=actor.id if actor else None,
        note=note,
        at=datetime.now(UTC),
    )


# --- Customer actions ---------------------------------------------------------


async def create_enquiry(
    db: AsyncSession, customer: User, *, items: list[dict], note: str | None
) -> Enquiry:
    if not items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "enquiry needs at least one item")

    variant_ids = [uuid.UUID(str(it["variant_id"])) for it in items]
    variants = {
        v.id: v
        for v in (
            await db.execute(
                select(ProductVariant)
                .options(selectinload(ProductVariant.product))
                .where(ProductVariant.id.in_(variant_ids))
            )
        ).scalars()
    }

    enq = Enquiry(reference=await _reference(db), customer_id=customer.id, note=note)
    db.add(enq)
    await db.flush()

    for it in items:
        vid = uuid.UUID(str(it["variant_id"]))
        variant = variants.get(vid)
        if variant is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"unknown variant {vid}")
        db.add(
            EnquiryItem(
                enquiry_id=enq.id,
                variant_id=vid,
                product_name_snapshot=variant.product.name,
                quantity=int(it["quantity"]),
            )
        )
    db.add(_history(enq, customer, "enquiry submitted"))
    db.add(
        AuditLog(
            actor_user_id=customer.id, action="enquiry.created", entity_type="enquiry",
            entity_id=str(enq.id), payload={"reference": enq.reference},
        )
    )
    await db.flush()
    await publish_event(
        role_channel("sales"), type="enquiry.created", entity="enquiry", entity_id=enq.reference,
        payload={"reference": enq.reference, "customer_id": str(customer.id)},
    )
    await db.commit()
    log.info("enquiry.created", reference=enq.reference)
    return await _load_full(db, enq.id)


async def post_message(db: AsyncSession, user: User, *, enquiry_id: uuid.UUID, body: str) -> Enquiry:
    enq = await _load(db, enquiry_id)
    _ensure_visible(enq, user)
    db.add(EnquiryMessage(enquiry_id=enq.id, sender_id=user.id, body=body))
    await db.flush()

    # Notify the other party.
    is_staff = user.role in (UserRole.sales, UserRole.manager, UserRole.admin)
    if is_staff:
        await notify_svc.notify(
            db, user_id=enq.customer_id, type=NotificationType.enquiry,
            title=f"New reply on {enq.reference}", link=f"/enquiries/{enq.id}",
        )
    elif enq.assigned_rep_id:
        await notify_svc.notify(
            db, user_id=enq.assigned_rep_id, type=NotificationType.enquiry,
            title=f"Customer replied on {enq.reference}", link=f"/enquiries/{enq.id}",
        )
    await publish_event(
        [user_channel(str(enq.customer_id))] + ([user_channel(str(enq.assigned_rep_id))] if enq.assigned_rep_id else []),
        type="enquiry.message", entity="enquiry", entity_id=enq.reference, payload={"reference": enq.reference},
    )
    await db.commit()
    return await _load_full(db, enq.id)


async def accept_quote(db: AsyncSession, customer: User, *, enquiry_id: uuid.UUID) -> Enquiry:
    enq = await _load(db, enquiry_id)
    if enq.customer_id != customer.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not your enquiry")
    _require_status(enq, EnquiryStatus.quoted)
    enq.status = EnquiryStatus.confirmed
    db.add(_history(enq, customer, "quote accepted"))
    if enq.assigned_rep_id:
        await notify_svc.notify(
            db, user_id=enq.assigned_rep_id, type=NotificationType.enquiry,
            title=f"Quote accepted: {enq.reference}", link=f"/enquiries/{enq.id}", priority="high",
        )
    await db.commit()
    return await _load_full(db, enq.id)


# --- Staff actions ------------------------------------------------------------


async def assign(db: AsyncSession, rep: User, *, enquiry_id: uuid.UUID, rep_id: uuid.UUID | None) -> Enquiry:
    enq = await _load(db, enquiry_id)
    enq.assigned_rep_id = rep_id or rep.id
    db.add(_history(enq, rep, f"assigned to {enq.assigned_rep_id}"))
    await db.commit()
    return await _load_full(db, enq.id)


async def quote(db: AsyncSession, rep: User, *, enquiry_id: uuid.UUID, lines: list[dict], valid_days: int) -> Enquiry:
    enq = await _load_full(db, enquiry_id)
    if enq.status not in (EnquiryStatus.pending, EnquiryStatus.quoted):
        raise HTTPException(status.HTTP_409_CONFLICT, f"cannot quote in status {enq.status.value}")

    price_by_item = {uuid.UUID(str(ln["item_id"])): int(ln["unit_price"]) for ln in lines}
    subtotal = 0
    for item in enq.items:
        if item.id in price_by_item:
            item.quoted_unit_price = price_by_item[item.id]
        if item.quoted_unit_price is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"missing price for item {item.id}")
        subtotal += item.quoted_unit_price * item.quantity

    enq.quoted_subtotal = subtotal
    enq.quoted_total = subtotal  # taxes/shipping applied at conversion
    enq.quote_valid_until = datetime.now(UTC) + timedelta(days=valid_days or 7)
    if enq.assigned_rep_id is None:
        enq.assigned_rep_id = rep.id
    enq.status = EnquiryStatus.quoted
    db.add(_history(enq, rep, "quote sent"))
    await notify_svc.notify(
        db, user_id=enq.customer_id, type=NotificationType.enquiry,
        title=f"You have a quote on {enq.reference}", link=f"/enquiries/{enq.id}", priority="high",
    )
    await publish_event(
        user_channel(str(enq.customer_id)), type="enquiry.quoted", entity="enquiry",
        entity_id=enq.reference, payload={"reference": enq.reference, "total": subtotal},
    )
    await db.commit()
    return await _load_full(db, enq.id)


async def reject(db: AsyncSession, actor: User, *, enquiry_id: uuid.UUID, reason: str | None) -> Enquiry:
    enq = await _load(db, enquiry_id)
    if enq.status in (EnquiryStatus.converted, EnquiryStatus.rejected):
        raise HTTPException(status.HTTP_409_CONFLICT, f"already {enq.status.value}")
    enq.status = EnquiryStatus.rejected
    db.add(_history(enq, actor, reason or "rejected"))
    await notify_svc.notify(
        db, user_id=enq.customer_id, type=NotificationType.enquiry,
        title=f"Enquiry {enq.reference} was closed", body=reason, link=f"/enquiries/{enq.id}",
    )
    await db.commit()
    return await _load_full(db, enq.id)


async def convert_to_order(db: AsyncSession, rep: User, *, enquiry_id: uuid.UUID) -> dict[str, Any]:
    """Turn a confirmed enquiry into a real order at the quoted prices."""
    from .orders import next_order_number

    enq = await _load_full(db, enquiry_id)
    _require_status(enq, EnquiryStatus.confirmed)

    from ..models.order import (
        Order,
        OrderItem,
        OrderStatus,
        OrderStatusHistory,
        PaymentMethod,
        PaymentStatus,
    )
    from . import pricing

    customer = (
        await db.execute(
            select(User).options(selectinload(User.profile)).where(User.id == enq.customer_id)
        )
    ).scalar_one()
    now = datetime.now(UTC)
    subtotal = gst = 0
    order_items = []
    for item in enq.items:
        variant = (
            await db.execute(
                select(ProductVariant).options(selectinload(ProductVariant.product)).where(
                    ProductVariant.id == item.variant_id
                )
            )
        ).scalar_one()
        line = pricing.compute_line(
            quantity=item.quantity, unit_price=item.quoted_unit_price or 0,
            gst_rate_pct=variant.product.gst_rate_pct,
        )
        subtotal += line.subtotal
        gst += line.gst_amount
        order_items.append((variant, item, line))

    order = Order(
        order_number=await next_order_number(db),
        user_id=customer.id,
        status=OrderStatus.confirmed,
        subtotal=subtotal, discount_total=0, gst_total=gst, shipping_total=0,
        grand_total=subtotal + gst,
        currency="INR",
        # Converted orders start with a placeholder address; the customer
        # confirms delivery details before dispatch. Values are non-empty so
        # the order response schema validates.
        shipping_address={
            "full_name": (customer.profile.full_name if customer.profile else None) or "Customer",
            "phone": customer.phone,
            "line1": "To be confirmed",
            "city": "TBD",
            "state": "TBD",
            "pincode": "000000",
        },
        payment_method=PaymentMethod.cod,
        payment_status=PaymentStatus.cod_pending,
        notes=f"Converted from enquiry {enq.reference}",
        placed_at=now, confirmed_at=now,
    )
    db.add(order)
    await db.flush()
    for variant, item, line in order_items:
        db.add(OrderItem(
            order_id=order.id, variant_id=variant.id,
            product_name_snapshot=variant.product.name, brand_snapshot=variant.product.brand,
            unit_label_snapshot=variant.unit_label, hsn_code_snapshot=variant.product.hsn_code,
            quantity=item.quantity, unit_price=line.unit_price, gst_rate_pct=line.gst_rate_pct,
            gst_amount=line.gst_amount, line_total=line.line_total,
        ))
    db.add(OrderStatusHistory(order_id=order.id, status=OrderStatus.confirmed, actor_user_id=rep.id, note=f"from {enq.reference}", at=now))

    enq.status = EnquiryStatus.converted
    enq.converted_order_id = order.id
    db.add(_history(enq, rep, f"converted to {order.order_number}"))
    await notify_svc.notify(
        db, user_id=enq.customer_id, type=NotificationType.order,
        title=f"Order {order.order_number} created from {enq.reference}",
        link=f"/orders/{order.order_number}", priority="high",
    )
    await db.commit()
    log.info("enquiry.converted", reference=enq.reference, order_number=order.order_number)
    return {"enquiry": _serialise(await _load_full(db, enq.id)), "order_number": order.order_number}


# --- Reads --------------------------------------------------------------------


async def list_for_customer(db: AsyncSession, *, customer_id: uuid.UUID) -> list[dict]:
    rows = (
        await db.execute(
            select(Enquiry).where(Enquiry.customer_id == customer_id).order_by(Enquiry.created_at.desc())
        )
    ).scalars().unique()
    return [_serialise(e) for e in rows]


async def list_queue(db: AsyncSession, *, status_filter: str | None, mine: uuid.UUID | None) -> list[dict]:
    stmt = select(Enquiry).order_by(Enquiry.created_at.desc())
    if status_filter:
        stmt = stmt.where(Enquiry.status == EnquiryStatus(status_filter))
    if mine:
        stmt = stmt.where(Enquiry.assigned_rep_id == mine)
    rows = (await db.execute(stmt)).scalars().unique()
    return [_serialise(e) for e in rows]


async def detail(db: AsyncSession, *, enquiry_id: uuid.UUID, user: User) -> dict:
    enq = await _load_full(db, enquiry_id)
    _ensure_visible(enq, user)
    return _serialise(enq, full=True)


# --- Internals ----------------------------------------------------------------


def _require_status(enq: Enquiry, expected: EnquiryStatus) -> None:
    if enq.status != expected:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"enquiry is {enq.status.value}, expected {expected.value}"
        )


async def _load_full(db: AsyncSession, enquiry_id: uuid.UUID) -> Enquiry:
    enq = (
        await db.execute(
            select(Enquiry)
            .options(
                selectinload(Enquiry.items),
                selectinload(Enquiry.messages),
                selectinload(Enquiry.history),
            )
            .where(Enquiry.id == enquiry_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if enq is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "enquiry not found")
    return enq


def _serialise(enq: Enquiry, *, full: bool = False) -> dict[str, Any]:
    data = {
        "id": enq.id,
        "reference": enq.reference,
        "status": enq.status.value,
        "customer_id": enq.customer_id,
        "assigned_rep_id": enq.assigned_rep_id,
        "note": enq.note,
        "quoted_subtotal": enq.quoted_subtotal,
        "quoted_total": enq.quoted_total,
        "quote_valid_until": enq.quote_valid_until,
        "converted_order_id": enq.converted_order_id,
        "created_at": enq.created_at,
        "items": [
            {
                "id": it.id,
                "variant_id": it.variant_id,
                "product_name": it.product_name_snapshot,
                "quantity": it.quantity,
                "quoted_unit_price": it.quoted_unit_price,
            }
            for it in enq.items
        ],
    }
    if full:
        data["messages"] = [
            {"id": m.id, "sender_id": m.sender_id, "body": m.body, "created_at": m.created_at}
            for m in enq.messages
        ]
        data["history"] = [
            {"status": h.status.value, "note": h.note, "at": h.at} for h in enq.history
        ]
    return data
