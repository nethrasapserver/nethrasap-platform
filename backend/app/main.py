"""FastAPI application factory + entry point.

Run locally:
    uv run uvicorn app.main:app --reload --port 8000

The factory pattern keeps tests fast (they import `app` directly and override
dependencies) and makes future multi-tenancy / per-region instances trivial.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.router import api_router_v1
from .config import get_settings
from .logging import configure_logging, get_logger
from .realtime.hub import hub
from .redis import close_redis

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


def create_app() -> FastAPI:
    app = FastAPI(
        title="Nethrasap API",
        version="0.1.0",
        description="Backend for the Nethrasap healthcare supply platform.",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router_v1, prefix="/api/v1")

    return app


app = create_app()
