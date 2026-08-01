"""Gate 4 — observability + resilience.

Covers the probe/metrics surface added in Gate 4:
- /health is a dependency-free liveness signal with build/version info.
- /ready checks Postgres + Redis and returns a clean 200 or 503 shape (Redis
  may or may not be reachable in the test env, so both outcomes are accepted).
- init_sentry() is inert (no-op, no exception) with no DSN configured.
- /metrics is served and returns Prometheus text.

Everything asserted here must hold with NO monitoring account provisioned.
"""
from __future__ import annotations

import pytest

from app.config import get_settings


@pytest.mark.asyncio
async def test_health_is_liveness_with_build_info(client):
    r = await client.get("/api/v1/health")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "nethrasap-api"
    # Build/version info is present for ops/deploy verification.
    assert body["version"] == get_settings().app_version
    assert "environment" in body


@pytest.mark.asyncio
async def test_ready_reports_dependency_shape(client):
    """DB is always up in tests; Redis may be up or down. Either way the
    response must be a well-formed 200 (ready) or 503 (not_ready) that names
    each dependency it checked."""
    r = await client.get("/api/v1/ready")
    assert r.status_code in (200, 503), r.text
    body = r.json()
    assert "checks" in body
    checks = body["checks"]
    # Both hard dependencies are always reported.
    assert "database" in checks
    assert "redis" in checks
    # The DB is reachable via the overridden test session.
    assert checks["database"] == "ok"

    if r.status_code == 200:
        assert body["status"] == "ready"
        assert checks["redis"] == "ok"
    else:
        # A clean 503 must be caused by a failed dependency, not a crash.
        assert body["status"] == "not_ready"
        assert "error" in checks.values()


def test_init_sentry_is_noop_without_dsn():
    """With no SENTRY_DSN (the default in dev/test), init_sentry() must return
    cleanly without importing/initialising the SDK or raising."""
    from app.observability import init_sentry

    assert get_settings().sentry_dsn == ""
    # Must not raise; returns None.
    assert init_sentry() is None
    # Idempotent — calling again is still a safe no-op.
    assert init_sentry() is None


@pytest.mark.asyncio
async def test_metrics_endpoint_serves_prometheus_text(client):
    # Generate at least one request so a counter series exists.
    await client.get("/api/v1/health")
    r = await client.get("/metrics")
    assert r.status_code == 200, r.text
    assert "text/plain" in r.headers.get("content-type", "")
    # The RED request counter is exposed.
    assert "http_requests_total" in r.text
