"""httpOnly-cookie refresh auth: cookie issuance, cookie/body fallback, logout.

The refresh token rides in the httpOnly `nethra_rt` cookie (path-scoped to
/api/v1/auth); `nethra_auth` is a readable role hint for Next middleware.
httpx's client has a cookie jar, so each test sets/clears `client.cookies`
explicitly to control whether the cookie or the body carries the token.
"""
from __future__ import annotations

import pytest

from .conftest import phone_for, signup

pytestmark = pytest.mark.asyncio

RT_COOKIE = "nethra_rt"
ROLE_COOKIE = "nethra_auth"


def _set_cookie_headers(resp) -> dict[str, str]:
    """Map cookie-name -> full Set-Cookie header (lowercased for attr checks)."""
    return {
        h.split("=", 1)[0].strip(): h.lower()
        for h in resp.headers.get_list("set-cookie")
    }


async def test_signup_sets_auth_cookies(client):
    resp = await signup(client, phone_for("cookie-signup"))
    assert resp.status_code == 201, resp.text
    pair = resp.json()

    headers = _set_cookie_headers(resp)
    assert RT_COOKIE in headers
    assert ROLE_COOKIE in headers

    rt_header = headers[RT_COOKIE]
    assert "httponly" in rt_header
    assert "samesite=lax" in rt_header
    assert "path=/api/v1/auth" in rt_header
    assert resp.cookies[RT_COOKIE] == pair["refresh_token"]

    role_header = headers[ROLE_COOKIE]
    assert "httponly" not in role_header  # readable UX hint, never trusted
    assert "samesite=lax" in role_header
    assert "path=/" in role_header
    assert resp.cookies[ROLE_COOKIE] == "customer"


async def test_refresh_with_cookie_only(client):
    resp = await signup(client, phone_for("cookie-refresh"))
    assert resp.status_code == 201, resp.text
    rt = resp.json()["refresh_token"]

    client.cookies.clear()
    client.cookies.set(RT_COOKIE, rt)
    r = await client.post("/api/v1/auth/refresh")  # no body at all
    assert r.status_code == 200, r.text
    pair = r.json()
    assert pair["refresh_token"] != rt  # rotated
    # Rotation re-sets both cookies on the response.
    headers = _set_cookie_headers(r)
    assert RT_COOKIE in headers and ROLE_COOKIE in headers
    assert r.cookies[RT_COOKIE] == pair["refresh_token"]


async def test_refresh_with_body_only(client):
    resp = await signup(client, phone_for("body-refresh"))
    assert resp.status_code == 201, resp.text
    rt = resp.json()["refresh_token"]

    client.cookies.clear()
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    assert r.status_code == 200, r.text
    assert r.json()["refresh_token"] != rt


async def test_refresh_without_cookie_or_body_is_401(client):
    client.cookies.clear()
    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 401, r.text
    assert r.json()["detail"] == "missing refresh token"

    # Empty JSON body (field omitted) is 401 too, not a 422.
    r = await client.post("/api/v1/auth/refresh", json={})
    assert r.status_code == 401, r.text
    assert r.json()["detail"] == "missing refresh token"


async def test_logout_clears_cookies_and_kills_session(client):
    resp = await signup(client, phone_for("cookie-logout"))
    assert resp.status_code == 201, resp.text
    pair = resp.json()
    rt = pair["refresh_token"]

    client.cookies.clear()
    client.cookies.set(RT_COOKIE, rt)
    out = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {pair['access_token']}"},
    )
    assert out.status_code == 204, out.text

    # Both cookies are expired on the logout response.
    headers = _set_cookie_headers(out)
    assert RT_COOKIE in headers and ROLE_COOKIE in headers
    for header in (headers[RT_COOKIE], headers[ROLE_COOKIE]):
        assert 'max-age=0' in header or "expires=" in header

    # The refresh session is dead: replaying the old cookie is a 401.
    client.cookies.clear()
    client.cookies.set(RT_COOKIE, rt)
    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 401, r.text


async def test_logout_without_token_is_401(client):
    client.cookies.clear()
    r = await client.post("/api/v1/auth/logout")
    assert r.status_code == 401, r.text
    assert r.json()["detail"] == "missing refresh token"
