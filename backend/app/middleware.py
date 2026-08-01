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
from starlette.responses import JSONResponse, Response

from .logging import get_logger

log = get_logger("app.access")

REQUEST_ID_HEADER = "X-Request-ID"
_MAX_REQUEST_ID_LEN = 128

# --- Request-body size caps (H-2 DoS guard) ---------------------------------
# JSON bodies are capped tight: nothing the API validates legitimately needs
# more than this, and buffering a huge body before validation is the DoS. The
# only large uploads are the CSV catalogue import (multipart/form-data), which
# enforces its OWN 5 MB chunked cap in api/v1/admin_catalogue.py — it (and any
# other multipart / non-JSON body) gets the higher absolute ceiling instead.
JSON_MAX_BODY_BYTES = 1 * 1024 * 1024  # 1 MB
MAX_BODY_BYTES = 10 * 1024 * 1024  # 10 MB absolute ceiling


def body_size_limit(content_type: str) -> int:
    """Max allowed Content-Length (bytes) for a request of this content-type.

    `application/json` is held to the tight cap; multipart uploads and anything
    else fall through to the absolute ceiling. Parameters after `;` (charset,
    multipart boundary) are ignored."""
    ct = content_type.split(";", 1)[0].strip().lower()
    if ct == "application/json":
        return JSON_MAX_BODY_BYTES
    return MAX_BODY_BYTES


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject over-cap requests by their declared Content-Length *before* the
    body is read/parsed, so a deeply-nested or oversized JSON payload can never
    be buffered or reach validation. Chunked requests (no Content-Length) fall
    through to the endpoint's own streaming cap (the CSV import has one).

    Registered inside RequestContextMiddleware so `request.state.request_id`
    is already set and the standard error envelope carries it."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        raw = request.headers.get("content-length")
        if raw:
            try:
                length = int(raw)
            except ValueError:
                length = None
            if length is not None:
                limit = body_size_limit(request.headers.get("content-type", ""))
                if length > limit:
                    request_id = getattr(request.state, "request_id", None)
                    payload: dict[str, object] = {
                        "detail": "request body too large",
                        "code": "payload_too_large",
                    }
                    if request_id:
                        payload["request_id"] = request_id
                    return JSONResponse(status_code=413, content=payload)
        return await call_next(request)


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
