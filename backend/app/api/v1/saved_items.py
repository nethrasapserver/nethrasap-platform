"""Wishlist + compare endpoints — a signed-in customer's saved products."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter

from ...db import DbSession
from ...deps import CurrentUser
from ...schemas.saved_items import CompareOut, WishlistOut
from ...services import saved_items as svc

router = APIRouter()


# --- Wishlist ---------------------------------------------------------------


@router.get("/wishlist", response_model=WishlistOut)
async def get_wishlist(db: DbSession, user: CurrentUser) -> WishlistOut:
    return WishlistOut(**await svc.get_wishlist(db, user=user))


@router.put("/wishlist/items/{product_id}", response_model=WishlistOut)
async def add_to_wishlist(product_id: UUID, db: DbSession, user: CurrentUser) -> WishlistOut:
    return WishlistOut(**await svc.add_to_wishlist(db, user=user, product_id=product_id))


@router.delete("/wishlist/items/{product_id}", response_model=WishlistOut)
async def remove_from_wishlist(product_id: UUID, db: DbSession, user: CurrentUser) -> WishlistOut:
    return WishlistOut(**await svc.remove_from_wishlist(db, user=user, product_id=product_id))


# --- Compare tray -----------------------------------------------------------


@router.get("/compare", response_model=CompareOut)
async def get_compare(db: DbSession, user: CurrentUser) -> CompareOut:
    return CompareOut(**await svc.get_compare(db, user=user))


@router.put("/compare/items/{product_id}", response_model=CompareOut)
async def add_to_compare(product_id: UUID, db: DbSession, user: CurrentUser) -> CompareOut:
    return CompareOut(**await svc.add_to_compare(db, user=user, product_id=product_id))


@router.delete("/compare/items/{product_id}", response_model=CompareOut)
async def remove_from_compare(product_id: UUID, db: DbSession, user: CurrentUser) -> CompareOut:
    return CompareOut(**await svc.remove_from_compare(db, user=user, product_id=product_id))


@router.delete("/compare", response_model=CompareOut)
async def clear_compare(db: DbSession, user: CurrentUser) -> CompareOut:
    return CompareOut(**await svc.clear_compare(db, user=user))
