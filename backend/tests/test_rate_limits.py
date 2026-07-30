"""Rate-limit tests — endpoint 429 wiring + limiter atomicity smoke test.

The limiter short-circuits under ENVIRONMENT=test unless
`app.redis.FORCE_IN_TESTS` is flipped. The `rl_redis` fixture flips it and
swaps `get_redis` for an in-memory fake whose `eval` mirrors the Lua script's
semantics (INCR, EXPIRE only on the first increment), so these tests need no
live Redis and leak no counters into other tests.
"""
from __future__ import annotations

import time

import pytest
import pytest_asyncio

from app import redis as redis_mod

from .conftest import phone_for, signup_token


class FakeRedis:
    """Minimal stand-in for the one call rate_limit() makes: EVAL of the
    fixed-window script. Tracks expiries so the atomicity smoke test can
    assert the TTL is set in the same step as the first increment."""

    def __init__(self) -> None:
        self.counts: dict[str, int] = {}
        self.expiry: dict[str, float] = {}

    def _purge(self, key: str) -> None:
        exp = self.expiry.get(key)
        if exp is not None and exp <= time.monotonic():
            self.counts.pop(key, None)
            self.expiry.pop(key, None)

    async def eval(self, script: str, numkeys: int, key: str, *args) -> int:
        assert numkeys == 1
        window_seconds = int(args[0])
        self._purge(key)
        count = self.counts.get(key, 0) + 1
        self.counts[key] = count
        if count == 1:
            self.expiry[key] = time.monotonic() + window_seconds
        return count

    async def ttl(self, key: str) -> int:
        self._purge(key)
        if key not in self.counts:
            return -2
        exp = self.expiry.get(key)
        if exp is None:
            return -1
        return int(exp - time.monotonic())


@pytest_asyncio.fixture
async def rl_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(redis_mod, "FORCE_IN_TESTS", True)
    monkeypatch.setattr(redis_mod, "get_redis", lambda: fake)
    yield fake
    # monkeypatch undoes both patches after this teardown, but the module
    # flag must never survive into other tests — reset it explicitly too.
    redis_mod.FORCE_IN_TESTS = False


@pytest.mark.asyncio
async def test_limiter_sets_ttl_on_first_increment(rl_redis):
    # First increment must set the window expiry in the same atomic step —
    # a key that gets a count but no TTL would deny forever once over limit.
    assert await redis_mod.rate_limit("unit:ttl", limit=3, window_seconds=60)
    assert await rl_redis.ttl("rl:unit:ttl") > 0

    assert await redis_mod.rate_limit("unit:ttl", limit=3, window_seconds=60)
    assert await redis_mod.rate_limit("unit:ttl", limit=3, window_seconds=60)
    # 4th call in the window exceeds limit=3.
    assert not await redis_mod.rate_limit("unit:ttl", limit=3, window_seconds=60)
    # An unrelated key is unaffected.
    assert await redis_mod.rate_limit("unit:other", limit=3, window_seconds=60)


@pytest.mark.asyncio
async def test_login_per_phone_limit_blocks_only_that_phone(client, rl_redis):
    phone_a = phone_for("rl-login-a")
    phone_b = phone_for("rl-login-b")
    await signup_token(client, phone_a)
    await signup_token(client, phone_b)

    # 10 failed attempts exhaust phone A's per-phone window (under the
    # 20/15min per-IP budget, so the per-phone counter is what trips).
    for _ in range(10):
        r = await client.post(
            "/api/v1/auth/login", json={"phone": phone_a, "password": "Wrong@Pass123"}
        )
        assert r.status_code == 401, r.text

    r = await client.post(
        "/api/v1/auth/login", json={"phone": phone_a, "password": "Strongp@ss123"}
    )
    assert r.status_code == 429, r.text

    # A different phone from the same IP still logs in fine.
    r = await client.post(
        "/api/v1/auth/login", json={"phone": phone_b, "password": "Strongp@ss123"}
    )
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_signup_sixth_request_same_ip_is_429(client, rl_redis):
    payload = {
        "role": "customer",
        "otp_token": "not-a-real-proof-token",
        "password": "Strongp@ss123",
        "name": "Rate Limit",
    }
    # The limit is checked before the proof token, so bogus tokens still
    # consume the 5/hour budget (and 401 rather than 429).
    for _ in range(5):
        r = await client.post("/api/v1/auth/signup", json=payload)
        assert r.status_code == 401, r.text

    r = await client.post("/api/v1/auth/signup", json=payload)
    assert r.status_code == 429, r.text
