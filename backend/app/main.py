"""FastAPI application factory + entry point.

Run locally:
    uv run uvicorn app.main:app --reload --port 8000

The factory pattern keeps tests fast (they import `app` directly and override
dependencies) and makes future multi-tenancy / per-region instances trivial.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api.v1.router import api_router_v1
from .config import get_settings
from .logging import configure_logging, get_logger
from .middleware import (
    REQUEST_ID_HEADER,
    BodySizeLimitMiddleware,
    RequestContextMiddleware,
)
from .observability import init_sentry, setup_metrics
from .realtime.hub import hub
from .redis import close_redis
from .schemas.common import ErrorResponse

settings = get_settings()
configure_logging(environment=settings.environment, level=settings.log_level)
log = get_logger("app.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "startup",
        environment=settings.environment,
        cors_origins=settings.cors_origins_list,
    )
    if settings.jwt_secret.startswith("REPLACE_ME"):
        # Only reachable in dev/test — config.py refuses to boot otherwise.
        log.warning(
            "jwt_secret is a placeholder — generate a real one with "
            "`python -c 'import secrets; print(secrets.token_urlsafe(64))'`"
        )
    await hub.start()
    yield
    await hub.stop()
    await close_redis()
    log.info("shutdown")


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _error_json(
    status_code: int,
    detail: str,
    request_id: str | None,
    *,
    code: str | None = None,
    errors: list[dict] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    payload = ErrorResponse(detail=detail, code=code, request_id=request_id, errors=errors)
    return JSONResponse(
        status_code=status_code,
        content=payload.model_dump(exclude_none=True),
        headers=headers,
    )


# Caps that keep the validation-error handler from recursing on (or leaking)
# a deeply-nested request body — see `_safe_validation_errors`.
_MAX_VALIDATION_ERRORS = 20
_MAX_ERR_STR_LEN = 300
_MAX_LOC_PARTS = 16


def _safe_validation_errors(exc: RequestValidationError) -> list[dict]:
    """Flatten pydantic's error list into a shallow, bounded shape.

    pydantic echoes the offending `input` (and `ctx`) back in each error. For a
    deeply-nested payload that structure is deep enough to blow the recursion
    limit inside `jsonable_encoder` (H-2: RecursionError -> unauthenticated 500
    on every validated endpoint) and it leaks the raw request body to the
    client. We keep only loc/msg/type — truncated and capped in count — so the
    tree we serialise is always flat and small.
    """
    safe: list[dict] = []
    for err in exc.errors()[:_MAX_VALIDATION_ERRORS]:
        loc = tuple(err.get("loc", ()))[:_MAX_LOC_PARTS]
        safe.append(
            {
                "loc": [str(p)[:_MAX_ERR_STR_LEN] for p in loc],
                "msg": str(err.get("msg", "invalid value"))[:_MAX_ERR_STR_LEN],
                "type": str(err.get("type", ""))[:_MAX_ERR_STR_LEN],
            }
        )
    return safe


def _validation_detail(errors: list[dict]) -> str:
    parts: list[str] = []
    for err in errors:
        loc = ".".join(str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path"))
        msg = err.get("msg", "invalid value")
        parts.append(f"{loc}: {msg}" if loc else msg)
    return "; ".join(parts) or "validation error"


def create_app() -> FastAPI:
    # Error reporting first so anything raised during wiring is captured. This
    # is a no-op until a Sentry DSN is provisioned (dormant by default).
    init_sentry()

    app = FastAPI(
        title="Nethrasap API",
        version="0.1.0",
        description="Backend for the Nethrasap healthcare supply platform.",
        # Interactive docs + the OpenAPI spec expose the full attack surface;
        # serve them only in dev/test, never in staging/production (M1).
        docs_url="/docs" if settings.is_dev else None,
        redoc_url="/redoc" if settings.is_dev else None,
        openapi_url="/openapi.json" if settings.is_dev else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Added before RequestContextMiddleware so the latter wraps it and the
    # request_id is already bound when the size guard emits a 413 envelope.
    app.add_middleware(BodySizeLimitMiddleware)
    app.add_middleware(RequestContextMiddleware)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = jsonable_encoder(_safe_validation_errors(exc))
        return _error_json(
            422,
            _validation_detail(errors),
            _request_id(request),
            code="validation_error",
            errors=errors,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException) -> Response | None:
        if request.scope["type"] != "http":
            # WebSocket handshake — leave routes/Starlette defaults untouched.
            return None
        if exc.status_code in (204, 304):
            return Response(status_code=exc.status_code, headers=exc.headers)
        detail: Any = exc.detail
        if not isinstance(detail, str):
            # Rare structured detail — pass through unchanged inside the envelope.
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": jsonable_encoder(detail), "request_id": _request_id(request)},
                headers=exc.headers,
            )
        return _error_json(exc.status_code, detail, _request_id(request), headers=exc.headers)

    @app.exception_handler(IntegrityError)
    async def _integrity_error(request: Request, exc: IntegrityError) -> JSONResponse:
        # Log the real constraint failure server-side; never leak it to clients.
        log.error("db_integrity_error", error=str(exc.orig))
        return _error_json(409, "conflict", _request_id(request), code="conflict")

    @app.exception_handler(Exception)
    async def _unhandled_error(request: Request, exc: Exception) -> JSONResponse:
        request_id = _request_id(request)
        log.exception("unhandled_exception")
        # This response is emitted by ServerErrorMiddleware, upstream of
        # RequestContextMiddleware — set the header here or it would be lost.
        headers = {REQUEST_ID_HEADER: request_id} if request_id else None
        return _error_json(500, "internal server error", request_id, headers=headers)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
        )
        if not settings.is_dev:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
            )
        return response

    app.include_router(api_router_v1, prefix="/api/v1")

    # RED metrics + GET /metrics (in-process counters; no external account).
    # Added last so its timing middleware wraps the full stack; it never reads
    # or mutates request.state, so request-id propagation is untouched.
    setup_metrics(app)

    return app


app = create_app()
