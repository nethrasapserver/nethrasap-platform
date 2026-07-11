"""Coupon endpoints — public read by code (for the cart UI to show a name)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ...db import DbSession
from ...models.cart import Coupon
from ...schemas.coupon import CouponOut

router = APIRouter()


@router.get("/{code}", response_model=CouponOut)
async def get_coupon(code: str, db: DbSession) -> CouponOut:
    coupon = (
        await db.execute(select(Coupon).where(Coupon.code == code.strip().upper()))
    ).scalar_one_or_none()
    if coupon is None or not coupon.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "coupon not found")
    return CouponOut.model_validate(coupon)
