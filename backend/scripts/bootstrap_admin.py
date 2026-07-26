"""One-time production bootstrap — create the first admin user from env vars.

A fresh production database has roles/permissions (seed_rbac) but zero users:
signup only creates customers, and staff roles are granted by an admin — so
without this script nobody can ever log into the ops dashboard.

Idempotent and safe to run on every deploy:
- If any admin user already exists, it exits without touching anything.
- If BOOTSTRAP_ADMIN_PHONE / BOOTSTRAP_ADMIN_PASSWORD are unset, it exits
  quietly (so it can sit in the pre-deploy hook unconditionally).

Usage (Render pre-deploy or shell):
    BOOTSTRAP_ADMIN_PHONE=+91XXXXXXXXXX BOOTSTRAP_ADMIN_PASSWORD=... \
        python -m scripts.bootstrap_admin

Rotate the password after first login; the env vars can then be removed.
"""
from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime

from sqlalchemy import select

from app.db import SessionLocal
from app.logging import configure_logging, get_logger
from app.models.user import User, UserProfile, UserRole, UserStatus
from app.phone import normalize_phone
from app.security import hash_password

configure_logging("production")
log = get_logger("scripts.bootstrap_admin")


async def main() -> None:
    phone = os.environ.get("BOOTSTRAP_ADMIN_PHONE", "").strip()
    password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "")
    if not phone or not password:
        log.info("bootstrap_admin.skipped", reason="env vars not set")
        return
    if len(password) < 10:
        raise SystemExit("BOOTSTRAP_ADMIN_PASSWORD must be at least 10 characters")

    async with SessionLocal() as db:
        existing_admin = (
            await db.execute(select(User).where(User.role == UserRole.admin).limit(1))
        ).scalar_one_or_none()
        if existing_admin is not None:
            log.info("bootstrap_admin.skipped", reason="an admin already exists")
            return

        norm = normalize_phone(phone)
        if (await db.execute(select(User).where(User.phone == norm))).scalar_one_or_none():
            raise SystemExit(f"{norm} exists but is not an admin — refusing to modify it")

        user = User(
            phone=norm,
            phone_verified_at=datetime.now(UTC),
            password_hash=hash_password(password),
            role=UserRole.admin,
            status=UserStatus.active,
        )
        user.profile = UserProfile(full_name="Administrator")
        db.add(user)
        await db.commit()
        log.info("bootstrap_admin.created", phone=norm)


if __name__ == "__main__":
    asyncio.run(main())
