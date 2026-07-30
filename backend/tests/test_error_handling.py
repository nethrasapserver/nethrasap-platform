"""Global error envelope + request-ID middleware behaviour."""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_unknown_route_returns_envelope_with_request_id(client):
    r = await client.get("/api/v1/definitely-not-a-route")
    assert r.status_code == 404
    body = r.json()
    assert body["detail"] == "Not Found"
    assert body["request_id"]
    assert r.headers["x-request-id"] == body["request_id"]


@pytest.mark.asyncio
async def test_validation_error_returns_422_envelope(client):
    r = await client.post("/api/v1/auth/login", json={})
    assert r.status_code == 422
    body = r.json()
    assert isinstance(body["detail"], str)
    assert body["detail"]
    assert body["request_id"]
    assert isinstance(body["errors"], list) and body["errors"]
    assert r.headers["x-request-id"] == body["request_id"]


@pytest.mark.asyncio
async def test_request_id_passthrough(client):
    rid = "test-rid-abc123"
    r = await client.get("/api/v1/health", headers={"X-Request-ID": rid})
    assert r.status_code == 200
    assert r.headers["x-request-id"] == rid


@pytest.mark.asyncio
async def test_request_id_passthrough_on_error(client):
    rid = "test-rid-err-456"
    r = await client.get("/api/v1/definitely-not-a-route", headers={"X-Request-ID": rid})
    assert r.status_code == 404
    assert r.headers["x-request-id"] == rid
    assert r.json()["request_id"] == rid


@pytest.mark.asyncio
async def test_blank_request_id_header_is_replaced(client):
    r = await client.get("/api/v1/health", headers={"X-Request-ID": "   "})
    assert r.status_code == 200
    assert r.headers["x-request-id"].strip()


@pytest.mark.asyncio
async def test_unhandled_exception_returns_500_envelope():
    """A throwaway route + a client that doesn't re-raise app exceptions
    (the shared `client` fixture would propagate the RuntimeError)."""
    route_path = "/__test_boom__"

    async def boom() -> None:
        raise RuntimeError("boom")

    app.router.add_api_route(route_path, boom, methods=["GET"])
    try:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            r = await ac.get(route_path, headers={"X-Request-ID": "rid-500-test"})
        assert r.status_code == 500
        body = r.json()
        assert body["detail"] == "internal server error"
        assert body["request_id"] == "rid-500-test"
        assert "boom" not in r.text  # never leak internals
        assert r.headers["x-request-id"] == "rid-500-test"
    finally:
        app.router.routes[:] = [
            rt for rt in app.router.routes if getattr(rt, "path", None) != route_path
        ]
