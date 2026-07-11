"""Payment webhook + client confirmation."""
from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from ...config import get_settings
from ...db import DbSession
from ...integrations import razorpay
from ...logging import get_logger
from ...services import payments as svc

log = get_logger("api.payments")
router = APIRouter()


@router.post("/payments/webhook")
async def razorpay_webhook(
    request: Request,
    db: DbSession,
    x_razorpay_signature: Annotated[str | None, Header()] = None,
) -> dict:
    """Razorpay → us. Verifies the HMAC over the raw body, then processes.

    Returns 200 for accepted-and-processed AND for ignored-but-valid events so
    Razorpay doesn't retry indefinitely; only signature failures are 400.
    """
    raw = await request.body()
    secret = get_settings().razorpay_webhook_secret
    if secret:
        if not x_razorpay_signature or not razorpay.verify_webhook_signature(
            raw, x_razorpay_signature, secret
        ):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid webhook signature")
    elif not get_settings().is_dev:
        # No secret configured in a non-dev environment is a misconfiguration.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "webhook secret not configured")

    try:
        body = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid JSON body") from e

    return await svc.handle_webhook(db, event=body.get("event", ""), payload=body)


class ConfirmRequest(BaseModel):
    razorpay_order_id: str = Field(min_length=6, max_length=80)
    razorpay_payment_id: str = Field(min_length=6, max_length=80)
    razorpay_signature: str = Field(min_length=6, max_length=160)


@router.post("/checkout/confirm")
async def checkout_confirm(payload: ConfirmRequest, db: DbSession) -> dict:
    """Client-side confirmation from the Razorpay Checkout modal."""
    return await svc.confirm_from_client(
        db,
        gateway_order_id=payload.razorpay_order_id,
        gateway_payment_id=payload.razorpay_payment_id,
        signature=payload.razorpay_signature,
    )
