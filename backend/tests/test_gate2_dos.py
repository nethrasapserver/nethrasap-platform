"""Gate 2 — DoS hardening + info-exposure closure.

Covers H-2 (nested-JSON RecursionError -> 500, and unbounded request bodies)
and the request-body size guard. Docs gating (M1) can't be exercised here — the
test env runs with ENVIRONMENT=test (is_dev True, docs on) — so we assert the
app still builds and note the prod behaviour to the lead.
"""
from __future__ import annotations

import json

import pytest

from app.config import get_settings
from app.middleware import (
    JSON_MAX_BODY_BYTES,
    MAX_BODY_BYTES,
    body_size_limit,
)

SIGNUP = "/api/v1/auth/signup"


@pytest.mark.asyncio
async def test_deeply_nested_json_is_handled_not_500(client):
    """Depth ~2000 JSON used to recurse through jsonable_encoder(exc.errors())
    -> RecursionError -> unauthenticated 500. It must now be handled."""
    nested: object = 1
    for _ in range(2000):
        nested = {"a": nested}
    body = json.dumps({"role": nested, "otp_token": nested, "password": nested})

    r = await client.post(
        SIGNUP, content=body, headers={"content-type": "application/json"}
    )
    assert r.status_code in (413, 422), r.text
    assert r.status_code != 500
    # Envelope stays intact and never echoes the raw nested payload back.
    the_body = r.json()
    assert the_body["request_id"]
    if r.status_code == 422:
        assert isinstance(the_body["errors"], list)
        assert len(the_body["errors"]) <= 20


@pytest.mark.asyncio
async def test_oversize_json_body_rejected_with_413(client):
    """A JSON body past the 1 MB cap is rejected up front (413), not buffered
    and parsed."""
    big = "x" * (JSON_MAX_BODY_BYTES + 1024)
    body = json.dumps({"role": "customer", "password": big})
    assert len(body) > JSON_MAX_BODY_BYTES

    r = await client.post(
        SIGNUP, content=body, headers={"content-type": "application/json"}
    )
    assert r.status_code == 413, r.text
    assert r.json()["code"] == "payload_too_large"


@pytest.mark.asyncio
async def test_small_valid_shape_still_validates(client):
    """A normal (invalid-but-small) body still gets a 422, never a spurious
    413."""
    r = await client.post(SIGNUP, json={})
    assert r.status_code == 422, r.text
    body = r.json()
    assert body["code"] == "validation_error"
    assert isinstance(body["errors"], list) and body["errors"]


def test_body_size_limit_exempts_multipart_and_csv():
    """The JSON cap must NOT apply to multipart uploads — the CSV import
    (multipart/form-data) legitimately sends more and enforces its own 5 MB
    chunked cap downstream."""
    assert body_size_limit("application/json") == JSON_MAX_BODY_BYTES
    assert body_size_limit("application/json; charset=utf-8") == JSON_MAX_BODY_BYTES
    # multipart (CSV import) + anything unknown -> higher absolute ceiling.
    assert body_size_limit("multipart/form-data; boundary=xyz") == MAX_BODY_BYTES
    assert body_size_limit("text/csv") == MAX_BODY_BYTES
    assert body_size_limit("") == MAX_BODY_BYTES
    # The CSV endpoint's own 5 MB cap sits comfortably under the 10 MB ceiling,
    # so the guard never pre-empts a legitimate import.
    assert MAX_BODY_BYTES > 5 * 1024 * 1024


@pytest.mark.asyncio
async def test_multipart_over_json_cap_not_blocked(client):
    """A ~2 MB multipart body (over the 1 MB JSON cap, under the 10 MB ceiling)
    must reach the endpoint — the guard returns anything but 413 here (auth
    kicks in first)."""
    payload = b"y" * (2 * 1024 * 1024)
    files = {"file": ("catalogue.csv", payload, "text/csv")}
    r = await client.post("/api/v1/admin/imports/catalogue", files=files)
    assert r.status_code != 413, r.text

    # The same size as application/json IS rejected — proving the cap is
    # content-type aware, not size-blind.
    body = json.dumps({"blob": "z" * (2 * 1024 * 1024)})
    r2 = await client.post(
        SIGNUP, content=body, headers={"content-type": "application/json"}
    )
    assert r2.status_code == 413, r2.text


def test_app_builds_with_docs_gated_in_dev():
    """Docs gating (M1): in dev/test (is_dev True) the docs URLs are live; in
    staging/production they are None. We can only assert the dev side here."""
    settings = get_settings()
    assert settings.is_dev is True
    from app.main import app

    assert app.docs_url == "/docs"
    assert app.openapi_url == "/openapi.json"
    # Prod behaviour (is_dev False) -> docs_url/redoc_url/openapi_url all None;
    # verified by the lead via live curl against a staging build.
