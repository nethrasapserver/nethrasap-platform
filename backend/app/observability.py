"""Observability wiring — Sentry error reporting + Prometheus metrics (M2).

Both integrations are designed to be *dormant until provisioned*:

- ``init_sentry()`` is a hard no-op unless ``settings.sentry_dsn`` is set. The
  ``sentry_sdk`` package is imported lazily *inside* that guard, so with no DSN
  (dev/test/unconfigured prod) nothing is imported, initialised, or sent — and
  a missing ``sentry-sdk`` install cannot break app boot.

- ``setup_metrics()`` exposes RED-style request metrics on ``GET /metrics``
  using ``prometheus-client`` (an in-process counter/histogram, no account and
  no network). It is gated behind ``settings.metrics_enabled`` (default on) and
  degrades to a no-op if ``prometheus-client`` is not installed.

Neither path touches ``request.state.request_id`` or the existing middleware
chain, so request-id propagation and access logging are unaffected.
"""
from __future__ import annotations

import time
from typing import TYPE_CHECKING

from fastapi import Response

from .config import get_settings
from .logging import get_logger

if TYPE_CHECKING:
    from fastapi import FastAPI

log = get_logger("observability")

# Paths we never record as metrics (self-scrape + probes) to keep cardinality
# and noise down.
_METRICS_EXCLUDE = {"/metrics"}

# --- Prometheus (optional hard-dep; degrade gracefully if absent) ------------
try:
    from prometheus_client import (
        CONTENT_TYPE_LATEST,
        Counter,
        Histogram,
        generate_latest,
    )

    _PROMETHEUS_AVAILABLE = True

    # Defined once at import time (module import is cached) so re-invoking
    # create_app() in tests never double-registers a collector.
    REQUEST_COUNT = Counter(
        "http_requests_total",
        "Total HTTP requests.",
        ["method", "path", "status"],
    )
    REQUEST_LATENCY = Histogram(
        "http_request_duration_seconds",
        "HTTP request latency in seconds.",
        ["method", "path"],
    )
except Exception:  # pragma: no cover - only when prometheus-client is missing
    _PROMETHEUS_AVAILABLE = False


def _route_template(request) -> str:
    """Prefer the matched route's path template over the raw URL path.

    Recording the template (``/api/v1/orders/{order_number}``) instead of the
    concrete path keeps label cardinality bounded; unmatched paths (404s) are
    bucketed under a single label so a scanner can't explode the series count.
    """
    route = request.scope.get("route")
    template = getattr(route, "path", None)
    return template or "__unmatched__"


def setup_metrics(app: FastAPI) -> None:
    """Wire the RED metrics middleware + ``GET /metrics`` onto ``app``.

    No-op when metrics are disabled or ``prometheus-client`` is unavailable.
    """
    settings = get_settings()
    if not settings.metrics_enabled:
        log.info("metrics.disabled")
        return
    if not _PROMETHEUS_AVAILABLE:
        log.warning("metrics.prometheus_client_missing_skipping")
        return

    @app.middleware("http")
    async def _metrics_middleware(request, call_next):
        if request.url.path in _METRICS_EXCLUDE:
            return await call_next(request)
        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            elapsed = time.perf_counter() - start
            path = _route_template(request)
            try:
                REQUEST_LATENCY.labels(request.method, path).observe(elapsed)
                REQUEST_COUNT.labels(request.method, path, str(status)).inc()
            except Exception:  # pragma: no cover - metrics must never break a request
                log.warning("metrics.record_failed")

    @app.get("/metrics", include_in_schema=False)
    async def metrics() -> Response:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    log.info("metrics.enabled")


def init_sentry() -> None:
    """Initialise Sentry only if a DSN is configured; otherwise a pure no-op.

    Safe to call unconditionally from ``create_app()``: with an empty DSN it
    returns immediately without importing ``sentry_sdk`` or opening any socket.
    """
    settings = get_settings()
    if not settings.sentry_dsn:
        # Dormant until the owner provisions Sentry. Nothing imported, nothing
        # initialised, nothing sent.
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except Exception:  # pragma: no cover - only if sentry-sdk isn't installed
        log.warning("sentry.sdk_not_installed_dsn_ignored")
        return

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment or settings.environment,
        release=settings.git_sha or settings.app_version,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        # Don't send request bodies / headers by default — this platform handles
        # OTPs, tokens and PII; keep them out of the error pipeline.
        send_default_pii=False,
    )
    log.info("sentry.initialised", environment=settings.sentry_environment or settings.environment)
