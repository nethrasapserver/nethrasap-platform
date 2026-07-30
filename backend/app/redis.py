"""Shared async Redis client + the primitives built on it.

Used for: rate limiting (auth/OTP), role-permission versioning (RBAC cache
busting), realtime pub/sub (app.realtime), and the arq job queue.
"""
from __future__ import annotations

from redis.asyncio import Redis, from_url

from .config import get_settings
from .logging import get_logger

log = get_logger("redis")

_client: Redis | None = None


def get_redis() -> Redis:
    global _client
    if _client is None:
        _client = from_url(get_settings().redis_url, decode_responses=True)
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


# --- Rate limiting ----------------------------------------------------------

# Tests flip this to exercise the limiter (see tests/test_rate_limits.py);
# it must stay False everywhere else so limits never leak between tests.
FORCE_IN_TESTS = False

# INCR + EXPIRE must be one atomic step: a crash between them would leave a
# counter with no TTL that blocks the key forever once it crosses the limit.
_RATE_LIMIT_LUA = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
"""


async def rate_limit(key: str, *, limit: int, window_seconds: int) -> bool:
    """Fixed-window counter. Returns True if the call is allowed.

    Fail-open in dev/test when Redis is down (so the API works before
    `docker compose up`), fail-closed everywhere else — an unreachable
    limiter in production must not disable brute-force protection.
    """
    settings = get_settings()
    if settings.environment == "test" and not FORCE_IN_TESTS:
        # Redis state survives the per-test DB rollback, so limits would leak
        # between tests/runs. The limiter itself gets its own unit tests.
        return True
    rkey = f"rl:{key}"
    try:
        r = get_redis()
        count = await r.eval(_RATE_LIMIT_LUA, 1, rkey, window_seconds)
        return int(count) <= limit
    except Exception:
        if get_settings().is_dev:
            log.warning("rate_limit.redis_unavailable_fail_open", key=key)
            return True
        log.exception("rate_limit.redis_unavailable_fail_closed", key=key)
        return False


# --- RBAC permission versioning ----------------------------------------------
# Access tokens embed the permission list resolved at login plus the role's
# version number. Editing a role bumps the version; tokens carrying an older
# version are rejected, forcing a refresh that re-resolves permissions.


def _pv_key(role: str) -> str:
    return f"role_pv:{role}"


async def get_role_permission_version(role: str) -> int:
    try:
        v = await get_redis().get(_pv_key(role))
        return int(v) if v else 0
    except Exception:
        if get_settings().is_dev:
            return 0
        raise


async def bump_role_permission_version(role: str) -> int:
    v = await get_redis().incr(_pv_key(role))
    log.info("rbac.permission_version_bumped", role=role, version=v)
    return int(v)
