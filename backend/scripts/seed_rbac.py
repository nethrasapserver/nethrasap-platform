"""Production-safe RBAC seed — roles + permissions only.

Idempotent and safe to run on EVERY deploy (Render pre-deploy hook). Seeds no
demo users, no catalogue — just the roles and permission grants the
authorization system needs to function. New permissions added in later
releases are picked up automatically on the next deploy.

    uv run python -m scripts.seed_rbac
"""
from __future__ import annotations

import asyncio

from app.db import SessionLocal
from app.logging import configure_logging, get_logger

# Reuse the single source of truth for role/permission definitions. Imported
# from scripts.rbac_data (NOT scripts.seed) so the production RBAC seed pulls in
# zero demo fixtures/credentials — seed.py is not even shipped in the image.
from scripts.rbac_data import seed_roles_and_permissions

configure_logging("production")
log = get_logger("scripts.seed_rbac")


async def main() -> None:
    async with SessionLocal() as db:
        await seed_roles_and_permissions(db)
        await db.commit()
    log.info("seed_rbac.done")


if __name__ == "__main__":
    asyncio.run(main())
