"""Cart endpoints — anon (cookie-keyed) + authed.

The single `_resolve_cart` helper picks the right cart based on whether
the caller is signed in. Logged-in users always operate on the user-keyed
cart; anonymous users on the cookie-keyed one.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, status

from ...db import DbSession
from ...deps import CartSession, OptionalUser
from ...schemas.cart import (
    CartItemAdd,
    CartItemUpdate,
    CartOut,
    CouponApply,
)
from ...services import cart as svc

router = APIRouter()


async def _resolve(db, user, session_id):
    cart = await svc.get_or_create_cart(db, user=user, session_id=session_id)
    return cart


@router.get("", response_model=CartOut)
async def get_cart(
    db: DbSession,
    user: OptionalUser,
    session_id: CartSession,
) -> CartOut:
    cart = await _resolve(db, user, session_id)
    payload = await svc.serialise_cart(db, cart, user)
    return CartOut.model_validate(payload)


@router.post("/items", response_model=CartOut, status_code=status.HTTP_201_CREATED)
async def add_item(
    payload: CartItemAdd,
    db: DbSession,
    user: OptionalUser,
    session_id: CartSession,
) -> CartOut:
    cart = await _resolve(db, user, session_id)
    await svc.add_item(
        db, cart=cart, variant_id=payload.variant_id, quantity=payload.quantity, user=user
    )
    await db.commit()
    # Re-fetch with relationships fresh.
    cart = await svc.get_or_create_cart(db, user=user, session_id=session_id)
    data = await svc.serialise_cart(db, cart, user)
    return CartOut.model_validate(data)


@router.patch("/items/{item_id}", response_model=CartOut)
async def update_item(
    item_id: UUID,
    payload: CartItemUpdate,
    db: DbSession,
    user: OptionalUser,
    session_id: CartSession,
) -> CartOut:
    cart = await _resolve(db, user, session_id)
    await svc.update_quantity(db, cart=cart, item_id=item_id, quantity=payload.quantity)
    await db.commit()
    cart = await svc.get_or_create_cart(db, user=user, session_id=session_id)
    data = await svc.serialise_cart(db, cart, user)
    return CartOut.model_validate(data)


@router.delete("/items/{item_id}", response_model=CartOut)
async def remove_item(
    item_id: UUID,
    db: DbSession,
    user: OptionalUser,
    session_id: CartSession,
) -> CartOut:
    cart = await _resolve(db, user, session_id)
    await svc.remove_item(db, cart=cart, item_id=item_id)
    await db.commit()
    cart = await svc.get_or_create_cart(db, user=user, session_id=session_id)
    data = await svc.serialise_cart(db, cart, user)
    return CartOut.model_validate(data)


@router.post("/coupon", response_model=CartOut)
async def apply_coupon(
    payload: CouponApply,
    db: DbSession,
    user: OptionalUser,
    session_id: CartSession,
) -> CartOut:
    cart = await _resolve(db, user, session_id)
    await svc.apply_coupon(db, cart=cart, code=payload.code)
    await db.commit()
    cart = await svc.get_or_create_cart(db, user=user, session_id=session_id)
    data = await svc.serialise_cart(db, cart, user)
    return CartOut.model_validate(data)


@router.delete("/coupon", response_model=CartOut)
async def clear_coupon(
    db: DbSession,
    user: OptionalUser,
    session_id: CartSession,
) -> CartOut:
    cart = await _resolve(db, user, session_id)
    await svc.clear_coupon(db, cart=cart)
    await db.commit()
    cart = await svc.get_or_create_cart(db, user=user, session_id=session_id)
    data = await svc.serialise_cart(db, cart, user)
    return CartOut.model_validate(data)
