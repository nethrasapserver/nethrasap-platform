"""Checkout endpoints — quote + place order."""
from __future__ import annotations

from fastapi import APIRouter, status

from ...db import DbSession
from ...deps import CartSession, ClientMeta, CurrentUser
from ...schemas.checkout import (
    PlaceOrderRequest,
    PlaceOrderResponse,
    QuoteRequest,
    QuoteResponse,
)
from ...services import cart as cart_svc
from ...services import checkout as svc

router = APIRouter()


@router.post("/quote", response_model=QuoteResponse)
async def quote(
    payload: QuoteRequest,
    db: DbSession,
    user: CurrentUser,
    session_id: CartSession,
) -> QuoteResponse:
    cart = await cart_svc.get_or_create_cart(db, user=user, session_id=session_id)
    result = await svc.quote(
        db, cart=cart, payment_method=payload.payment_method, user=user
    )
    return QuoteResponse(**result)


@router.post(
    "/place",
    response_model=PlaceOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def place_order(
    payload: PlaceOrderRequest,
    db: DbSession,
    user: CurrentUser,
    meta: ClientMeta,
    session_id: CartSession,
) -> PlaceOrderResponse:
    cart = await cart_svc.get_or_create_cart(db, user=user, session_id=session_id)
    result = await svc.place_order(
        db,
        cart=cart,
        user=user,
        address=payload.address.model_dump(),
        payment_method=payload.payment_method,
        client_request_id=payload.client_request_id,
        notes=payload.notes,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
    )
    return PlaceOrderResponse(**result)
