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


async def reset(force: bool = False) -> None:
    if not settings.is_dev and not force:
        raise SystemExit("Refusing to reset: ENVIRONMENT is not dev. Pass --force.")

    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("sqlalchemy.url", _normalise_url(settings.database_url)[0])

    log.info("reset.downgrade", target="base")
    command.downgrade(cfg, "base")

    log.info("reset.upgrade", target="head")
    command.upgrade(cfg, "head")

    log.info("reset.seed")
    # Import lazily so we get fresh engine + bindings post-migration.
    from scripts.seed import main as seed_main

    await seed_main(force=force)
    log.info("reset.done")


if __name__ == "__main__":
    force = "--force" in sys.argv
    asyncio.run(reset(force=force))
