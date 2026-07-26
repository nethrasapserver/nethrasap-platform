"""Pincode lookup — cache hit, network fallback, graceful miss."""
from __future__ import annotations

import pytest

from app.models.pincode import Pincode


@pytest.mark.asyncio
async def test_lookup_hits_cache_without_network(client, db_session, monkeypatch):
    # Seed a cached PIN, then force the provider off so any network use fails.
    db_session.add(
        Pincode(pincode="638167", city="Modakkurichi", district="Erode", state="Tamil Nadu")
    )
    await db_session.commit()

    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "pincode_provider", "none")
    r = await client.get("/api/v1/pincodes/638167")
    assert r.status_code == 200
    body = r.json()
    assert body["city"] == "Modakkurichi"
    assert body["district"] == "Erode"
    assert body["state"] == "Tamil Nadu"


@pytest.mark.asyncio
async def test_unknown_pin_with_provider_off_is_404(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "pincode_provider", "none")
    r = await client.get("/api/v1/pincodes/999999")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_malformed_pin_is_404(client):
    r = await client.get("/api/v1/pincodes/12ab")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_fetch_populates_cache(client, db_session, monkeypatch):
    """A miss resolves via the provider (stubbed) and is cached for next time."""
    from app.services import pincodes as svc

    async def fake_fetch(pin, url):
        return {"city": "Bazargate", "district": "Mumbai", "state": "Maharashtra"}

    monkeypatch.setattr(svc, "_fetch_india_post", fake_fetch)

    r = await client.get("/api/v1/pincodes/400001")
    assert r.status_code == 200
    assert r.json()["state"] == "Maharashtra"

    # Now it's cached — turning the provider off still resolves it.
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "pincode_provider", "none")
    r2 = await client.get("/api/v1/pincodes/400001")
    assert r2.status_code == 200
    assert r2.json()["district"] == "Mumbai"
