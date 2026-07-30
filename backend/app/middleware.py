"""Request-context middleware: request IDs + one access-log line per request.

`app/logging.py` already wires `structlog.contextvars.merge_contextvars` into
the processor chain, so anything logged while a request is in flight carries
`request_id`, `path` and `method` automatically.
"""
from __future__ import annotations

import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from .logging import get_logger

log = get_logger("app.access")

REQUEST_ID_HEADER = "X-Request-ID"
_MAX_REQUEST_ID_LEN = 128


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Generate (or honour) an X-Request-ID, bind it into structlog
    contextvars, echo it on the response and emit a structured access log."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER, "").strip()
        request_id = incoming if 0 < len(incoming) <= _MAX_REQUEST_ID_LEN else uuid.uuid4().hex
        request.state.request_id = request_id

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            path=request.url.path,
            method=request.method,
        )

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            # The catch-all handler (ServerErrorMiddleware) produces the 500
            # response upstream of us — log the access line here, then let it.
            log.info(
                "request",
                method=request.method,
                path=request.url.path,
                status=500,
                duration_ms=round((time.perf_counter() - start) * 1000, 2),
            )
            raise

        response.headers.setdefault(REQUEST_ID_HEADER, request_id)
        log.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round((time.perf_counter() - start) * 1000, 2),
        )
        return response
