"""Cart service — anon + authed carts, item CRUD, coupon application, merge."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..logging import get_logger
from ..models.cart import Cart, CartItem, Coupon
from ..models.catalogue import (
    PriceRole,
    Product,
    ProductImage,
    ProductVariant,
)
from ..models.user import User
from . import pricing
from .catalogue import _price_role_for_user, active_price_for, price_is_quote_band

log = get_logger("services.cart")

CART_TTL_DAYS = 30


# ---------------------------------------------------------------------------
# Cart resolution
# ---------------------------------------------------------------------------
async def get_or_create_cart(
    db: AsyncSession,
    *,
    user: User | None = None,
    session_id: str | None = None,
) -> Cart:
    """Return the caller's cart, creating one if necessary.

    Logged-in users always operate on a cart keyed by `user_id`. Anonymous
    users get one keyed by `session_id`.
    """
    # populate_existing: routers re-fetch the cart after a mutating commit to
    # build the response. Without it, the identity map hands back the already
    # loaded object with STALE relationship collections (removed items /
    # coupon changes wouldn't show in the response).
    base = (
        select(Cart)
        .options(selectinload(Cart.items), selectinload(Cart.coupon))
        .execution_options(populate_existing=True)
    )
    cart: Cart | None = None
    if user is not None:
        cart = (await db.execute(base.where(Cart.user_id == user.id))).scalar_one_or_none()
    elif session_id is not None:
        cart = (await db.execute(base.where(Cart.session_id == session_id))).scalar_one_or_none()
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "missing cart identity")

    if cart is None:
        cart = Cart(
            user_id=user.id if user else None,
            session_id=session_id if user is None else None,
            expires_at=datetime.now(UTC) + timedelta(days=CART_TTL_DAYS),
        )
        db.add(cart)
        await db.flush()
        # Reload with relationships eager-loaded so downstream code never
        # triggers an implicit lazy SELECT (which fails outside the async
        # greenlet context).
        cart = (
            await db.execute(
                select(Cart)
                .options(selectinload(Cart.items), selectinload(Cart.coupon))
                .where(Cart.id == cart.id)
            )
        ).scalar_one()
    return cart


async def merge_session_cart_into_user(
    db: AsyncSession, *, session_id: str, user: User
) -> None:
    """Called on signup/login when an anon-session cookie is present.

    Strategy: if the user has no cart yet, simply re-point the anon cart's
    `user_id` to them. If they already have a cart, fold the anon items in,
    summing quantities for any variant present in both, then delete the anon
    cart.
    """
    anon = (
        await db.execute(
            select(Cart)
            .options(selectinload(Cart.items))
            .where(Cart.session_id == session_id)
        )
    ).scalar_one_or_none()
    if anon is None:
        return

    user_cart = (
        await db.execute(
            select(Cart)
            .options(selectinload(Cart.items))
            .where(Cart.user_id == user.id)
        )
    ).scalar_one_or_none()

    if user_cart is None:
        # Adopt the anon cart wholesale.
        anon.user_id = user.id
        anon.session_id = None
        anon.expires_at = None
        await db.flush()
        log.info("cart.merge.adopted", cart_id=str(anon.id), user_id=str(user.id))
        return

    # Fold items in.
    by_variant = {it.variant_id: it for it in user_cart.items}
    folded = 0
    for it in list(anon.items):
        if it.variant_id in by_variant:
            by_variant[it.variant_id].quantity += it.quantity
        else:
            it.cart_id = user_cart.id
            folded += 1
    await db.flush()
    await db.delete(anon)
    await db.flush()
    log.info(
        "cart.merge.folded",
        user_cart_id=str(user_cart.id),
        anon_cart_id=str(anon.id),
        items_folded=folded,
    )


# ---------------------------------------------------------------------------
# Variant resolution + price snapshot
# ---------------------------------------------------------------------------
async def _resolve_variant_and_price(
    db: AsyncSession, *, variant_id: uuid.UUID, user: User | None
) -> tuple[ProductVariant, Product, int, int]:
    """Returns (variant, product, unit_price_paise, gst_rate_pct).

    Pricing follows the same role-aware resolution as the catalogue service.
    """
    price_role = _price_role_for_user(user)
    stmt = (
        select(ProductVariant)
        .options(
            selectinload(ProductVariant.product),
            selectinload(ProductVariant.prices),
        )
        .where(ProductVariant.id == variant_id)
    )
    variant = (await db.execute(stmt)).scalar_one_or_none()
    if variant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "variant not found")
    if not variant.product.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, "product is not available")

    # Active price for caller's role, fallback to customer
    active = next(
        (p for p in variant.prices if p.role == price_role and p.valid_to is None),
        None,
    )
    if active is None:
        active = next(
            (p for p in variant.prices if p.role == PriceRole.customer and p.valid_to is None),
            None,
        )
    if active is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "product has no active price")
    return variant, variant.product, active.selling_price, variant.product.gst_rate_pct


# ---------------------------------------------------------------------------
# Item operations
# ---------------------------------------------------------------------------
async def add_item(
    db: AsyncSession,
    *,
    cart: Cart,
    variant_id: uuid.UUID,
    quantity: int,
    user: User | None,
) -> CartItem:
    if quantity < 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "quantity must be >= 1")

    variant, product, unit_price, gst_rate = await _resolve_variant_and_price(
        db, variant_id=variant_id, user=user
    )

    existing = next((it for it in cart.items if it.variant_id == variant_id), None)
    if existing is not None:
        existing.quantity += quantity
        # Refresh the snapshot on add so the user sees the current price.
        existing.unit_price_snapshot = unit_price
        existing.gst_rate_pct_snapshot = gst_rate
        await db.flush()
        return existing

    item = CartItem(
        cart_id=cart.id,
        variant_id=variant.id,
        quantity=quantity,
        unit_price_snapshot=unit_price,
        gst_rate_pct_snapshot=gst_rate,
        currency_snapshot="INR",
    )
    db.add(item)
    cart.items.append(item)
    await db.flush()
    return item


async def update_quantity(
    db: AsyncSession, *, cart: Cart, item_id: uuid.UUID, quantity: int
) -> CartItem:
    if quantity < 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "quantity must be >= 1")
    item = next((it for it in cart.items if it.id == item_id), None)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "cart item not found")
    item.quantity = quantity
    await db.flush()
    return item


async def remove_item(db: AsyncSession, *, cart: Cart, item_id: uuid.UUID) -> None:
    item = next((it for it in cart.items if it.id == item_id), None)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "cart item not found")
    await db.delete(item)
    await db.flush()


async def clear_cart_items(
    db: AsyncSession, *, cart: Cart, only_item_ids: set[uuid.UUID] | None = None
) -> None:
    """Empties the cart (used after order placement).

    `only_item_ids` removes just those lines — checkout passes the fixed-price
    items it actually sold, so quote-priced lines survive for the RFQ path.
    The coupon is released either way: it was consumed by (or no longer
    matches) the order that just went through.
    """
    for it in list(cart.items):
        if only_item_ids is None or it.id in only_item_ids:
            await db.delete(it)
    # Direct UPDATE to avoid the relationship-sync lazy load.
    await db.execute(
        update(Cart).where(Cart.id == cart.id).values(coupon_id=None)
    )
    await db.flush()


# ---------------------------------------------------------------------------
# Coupons
# ---------------------------------------------------------------------------
async def apply_coupon(db: AsyncSession, *, cart: Cart, code: str) -> Coupon:
    coupon = (
        await db.execute(select(Coupon).where(Coupon.code == code.strip().upper()))
    ).scalar_one_or_none()

    subtotal = sum(it.unit_price_snapshot * it.quantity for it in cart.items)
    eligible, reason = pricing.is_coupon_eligible(coupon, subtotal)
    if coupon is None or not eligible:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, reason or "coupon invalid")

    # Direct UPDATE — avoids triggering a relationship sync (which would
    # lazy-load `cart.coupon`, failing outside the async greenlet context).
    await db.execute(
        update(Cart).where(Cart.id == cart.id).values(coupon_id=coupon.id)
    )
    await db.flush()
    return coupon


async def clear_coupon(db: AsyncSession, *, cart: Cart) -> None:
    await db.execute(
        update(Cart).where(Cart.id == cart.id).values(coupon_id=None)
    )
    await db.flush()


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------
async def serialise_cart(db: AsyncSession, cart: Cart, user: User | None = None) -> dict[str, Any]:
    """Build the public cart response shape. Eager-loads everything it reads
    so no implicit lazy SELECTs fire from inside Pydantic serialisation.

    Quote-only items (indicative price band at the caller's tier) are flagged
    and EXCLUDED from every total — their price doesn't exist until a rep
    quotes it, so showing it in a payable total would be a lie.
    """
    items_out: list[dict[str, Any]] = []
    subtotal = 0
    gst = 0
    price_role = _price_role_for_user(user)

    variant_ids = [it.variant_id for it in cart.items]
    variants_by_id: dict[uuid.UUID, ProductVariant] = {}
    primary_image_by_product: dict[uuid.UUID, ProductImage] = {}
    has_cold_chain = False

    if variant_ids:
        rows = (
            await db.execute(
                select(ProductVariant)
                .options(
                    selectinload(ProductVariant.product).selectinload(Product.images),
                    selectinload(ProductVariant.product).selectinload(Product.category),
                    selectinload(ProductVariant.prices),
                )
                .where(ProductVariant.id.in_(variant_ids))
            )
        ).scalars().all()
        for v in rows:
            variants_by_id[v.id] = v
            for img in v.product.images:
                if img.is_primary:
                    primary_image_by_product[v.product.id] = img
                    break

    for it in cart.items:
        variant = variants_by_id.get(it.variant_id)
        is_quote = price_is_quote_band(active_price_for(variant, price_role))
        line = pricing.compute_line(
            quantity=it.quantity,
            unit_price=it.unit_price_snapshot,
            gst_rate_pct=it.gst_rate_pct_snapshot,
        )
        if not is_quote:
            subtotal += line.subtotal
            gst += line.gst_amount
            if (
                variant is not None
                and variant.product.category is not None
                and variant.product.category.slug == "cold-chain"
            ):
                has_cold_chain = True
        product = variant.product if variant else None
        primary_image = primary_image_by_product.get(product.id) if product else None
        items_out.append(
            {
                "id": it.id,
                "variant_id": it.variant_id,
                "quantity": it.quantity,
                "unit_price": it.unit_price_snapshot,
                "gst_rate_pct": it.gst_rate_pct_snapshot,
                "line_subtotal": line.subtotal,
                "is_quote_only": is_quote,
                "product": {
                    "id": product.id if product else None,
                    "slug": product.slug if product else "",
                    "name": product.name if product else "",
                    "unit_label": variant.unit_label if variant else "",
                    "stock_status": product.stock_status.value if product else "in_stock",
                    "image_storage_key": primary_image.storage_key if primary_image else None,
                },
            }
        )

    # Only touch the coupon relationship if a coupon is actually attached.
    coupon = cart.coupon if cart.coupon_id else None
    discount = pricing.coupon_discount(coupon, subtotal)
    subtotal_after_discount = subtotal - discount

    shipping = pricing.shipping_for(
        subtotal_after_discount=subtotal_after_discount,
        has_cold_chain=has_cold_chain,
    )
    grand = subtotal - discount + gst + shipping

    coupon_payload = (
        {
            "code": coupon.code,
            "type": coupon.type.value,
            "value": coupon.value,
            "discount": discount,
        }
        if coupon is not None and discount > 0
        else None
    )

    return {
        "id": cart.id,
        "user_id": cart.user_id,
        "session_id": cart.session_id,
        "items": items_out,
        "totals": {
            "subtotal": subtotal,
            "discount": discount,
            "gst": gst,
            "shipping": shipping,
            "grand_total": max(0, grand),
            "currency": "INR",
        },
        "coupon": coupon_payload,
        "currency": "INR",
        "updated_at": cart.updated_at,
    }
