"""FastAPI application factory + entry point.

Run locally:
    uv run uvicorn app.main:app --reload --port 8000

The factory pattern keeps tests fast (they import `app` directly and override
dependencies) and makes future multi-tenancy / per-region instances trivial.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .api.v1.router import api_router_v1
from .config import get_settings
from .logging import configure_logging, get_logger

settings = get_settings()
configure_logging(environment=settings.environment, level=settings.log_level)
log = get_logger("app.main")

REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "startup",
        environment=settings.environment,
        cors_origins=settings.cors_origins_list,
    )
    if settings.jwt_secret.startswith("REPLACE_ME"):
        log.warning(
            "jwt_secret is a placeholder — generate a real one with "
            "`python -c 'import secrets; print(secrets.token_urlsafe(64))'`"
        )
    yield
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

    # Optional: serve the built SPA so the backend can be the single origin in
    # staging/prod. In dev the frontend runs separately on :5173 and proxies
    # /api/* here — see frontend/vite.config.ts.
    if FRONTEND_DIST.exists():
        app.mount(
            "/assets",
            StaticFiles(directory=FRONTEND_DIST / "assets"),
            name="frontend-assets",
        )

        @app.get("/", include_in_schema=False)
        async def spa_root() -> FileResponse:
            return FileResponse(FRONTEND_DIST / "index.html")

        @app.exception_handler(404)
        async def spa_fallback(request: Request, exc) -> FileResponse | JSONResponse:
            # API 404s stay as JSON. Everything else returns the SPA so
            # client-side routing can handle the path.
            if request.url.path.startswith("/api/"):
                return JSONResponse({"detail": "Not found"}, status_code=404)
            return FileResponse(FRONTEND_DIST / "index.html")

    return app


app = create_app()
