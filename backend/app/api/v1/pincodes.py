"""Pincode lookup — powers checkout address autofill. Public (address help)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ...db import DbSession
from ...services import pincodes as svc

router = APIRouter()


class PincodeOut(BaseModel):
    pincode: str
    city: str
    district: str
    state: str


@router.get("/pincodes/{pincode}", response_model=PincodeOut)
async def resolve_pincode(pincode: str, db: DbSession) -> PincodeOut:
    row = await svc.lookup(db, pincode)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "pincode not found")
    return PincodeOut(
        pincode=row.pincode, city=row.city, district=row.district, state=row.state
    )
