"""Pincode → city / district / state, cached.

First lookup for a PIN hits the configured postal provider and stores the
result; every lookup after is a single-row read. Checkout must never depend on
the external call succeeding, so a miss or a provider error simply returns None
and the customer types the address by hand.
"""
from __future__ import annotations

import asyncio
import re

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..logging import get_logger
from ..models.pincode import Pincode

log = get_logger("services.pincodes")

_PIN_RE = re.compile(r"^\d{6}$")
# Post-office names carry branch suffixes (S.O / B.O / H.O / G.P.O) that aren't
# part of a usable city name.
_OFFICE_SUFFIX = re.compile(r"\s+(?:S\.?O|B\.?O|H\.?O|G\.?P\.?O|R\.?S)\.?$", re.IGNORECASE)


def _clean_locality(name: str) -> str:
    return _OFFICE_SUFFIX.sub("", name or "").strip()


async def lookup(db: AsyncSession, pincode: str) -> Pincode | None:
    pin = (pincode or "").strip()
    if not _PIN_RE.match(pin):
        return None

    cached = (await db.execute(select(Pincode).where(Pincode.pincode == pin))).scalar_one_or_none()
    if cached is not None:
        return cached

    settings = get_settings()
    if settings.pincode_provider == "none":
        return None

    resolved = await _fetch_india_post(pin, settings.pincode_api_url)
    if resolved is None:
        return None

    row = Pincode(pincode=pin, source="india_post", **resolved)
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        # Concurrent request cached it first — read theirs.
        await db.rollback()
        return (await db.execute(select(Pincode).where(Pincode.pincode == pin))).scalar_one_or_none()
    return row


async def _fetch_india_post(pin: str, base_url: str) -> dict[str, str] | None:
    """Return {city, district, state} or None. Never raises.

    The public India Post API is flaky — it times out or 5xx's intermittently.
    A single hiccup used to surface as a permanent "not found" to the customer,
    so transient errors are retried a few times before giving up.
    """
    url = f"{base_url.rstrip('/')}/{pin}"
    payload = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(url)
            resp.raise_for_status()
            payload = resp.json()
            break
        except Exception:
            log.warning("pincode.fetch_failed", pincode=pin, attempt=attempt + 1)
            if attempt < 2:
                await asyncio.sleep(0.4 * (attempt + 1))
    if payload is None:
        return None

    if not isinstance(payload, list) or not payload:
        return None
    block = payload[0]
    if block.get("Status") != "Success":
        return None
    offices = block.get("PostOffice") or []
    if not offices:
        return None

    first = offices[0]
    district = (first.get("District") or "").strip()
    state = (first.get("State") or "").strip()
    if not district or not state:
        return None
    # Prefer the block/taluk as the city; fall back to the cleaned office name.
    city = (first.get("Block") or "").strip() or _clean_locality(first.get("Name", "")) or district
    return {"city": city, "district": district, "state": state}
