"""Drop all tables, re-run migrations, re-seed. DESTRUCTIVE.

    uv run python -m scripts.reset_db

Refuses to run unless ENVIRONMENT=dev (or --force is passed).
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from app.config import get_settings
from app.db import _normalise_url
from app.logging import configure_logging, get_logger

configure_logging("dev")
log = get_logger("scripts.reset")
settings = get_settings()

BACKEND_ROOT = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_ROOT / "alembic.ini"


def _alembic_config() -> Config:
    cfg = Config(str(ALEMBIC_INI))
    # Anchor script discovery so this works regardless of the process CWD.
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    cfg.set_main_option("sqlalchemy.url", _normalise_url(settings.database_url)[0])
    return cfg


def _run_migrations() -> None:
    """Downgrade to base then upgrade to head.

    Alembic's env.py drives async migrations via ``asyncio.run()``. That cannot
    be nested inside an already-running event loop, so the migration commands run
    here in a plain synchronous context — never from within ``asyncio.run()``.
    """
    cfg = _alembic_config()

    log.info("reset.downgrade", target="base")
    command.downgrade(cfg, "base")

    log.info("reset.upgrade", target="head")
    command.upgrade(cfg, "head")


async def _seed(force: bool) -> None:
    log.info("reset.seed")
    # Import lazily so we get fresh engine + bindings post-migration.
    from scripts.seed import main as seed_main

    await seed_main(force=force)


def main(force: bool = False) -> None:
    if not settings.is_dev and not force:
        raise SystemExit("Refusing to reset: ENVIRONMENT is not dev. Pass --force.")

    # Migrations first, in a synchronous context (see _run_migrations), then the
    # async seed in its own event loop.
    _run_migrations()
    asyncio.run(_seed(force=force))
    log.info("reset.done")


if __name__ == "__main__":
    main(force="--force" in sys.argv)
