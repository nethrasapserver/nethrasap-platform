"""Single source of truth for RBAC role/permission definitions + the seeder.

Extracted out of ``scripts.seed`` so the production RBAC seed
(``scripts.seed_rbac``) can import it WITHOUT dragging in the dev-only demo
fixtures (``DEMO_PASSWORD`` / ``DEMO_USERS`` / ``seed_demo_users``). This keeps
the lean runtime image free of any hardcoded demo credentials.

This module has no side effects on import (it does not configure logging or open
a DB session) — callers own that. It depends only on the RBAC models and
SQLAlchemy, so it is safe to ship in the production image on its own.
"""
from __future__ import annotations

from app.logging import get_logger
from app.models.rbac import Permission, Role, RolePermission
from sqlalchemy import select

log = get_logger("scripts.rbac_data")


# ---------------------------------------------------------------------------
# Roles + permissions seed
# ---------------------------------------------------------------------------
ROLE_DEFS: list[dict] = [
    {"name": "customer", "description": "Walk-in/online customer — MRP pricing"},
    {"name": "clinician", "description": "Verified clinician — institutional pricing"},
    {"name": "retailer", "description": "Verified retailer — wholesale pricing"},
    {"name": "sales", "description": "Sales rep — manages assigned accounts"},
    {"name": "manager", "description": "Sales manager — supervises sales team"},
    {"name": "admin", "description": "Platform admin — full access"},
]

PERMISSION_DEFS: list[dict] = [
    # storefront
    {"resource": "products", "action": "read", "description": "Read public catalogue"},
    {"resource": "products", "action": "create"},
    {"resource": "products", "action": "update"},
    {"resource": "products", "action": "delete"},
    {"resource": "orders", "action": "read_own"},
    {"resource": "orders", "action": "read_assigned"},
    {"resource": "orders", "action": "read_all"},
    {"resource": "orders", "action": "create"},
    {"resource": "orders", "action": "refund"},
    {"resource": "orders", "action": "fulfil"},
    # users
    {"resource": "users", "action": "read"},
    {"resource": "users", "action": "update_role"},
    {"resource": "users", "action": "suspend"},
    # kyc
    {"resource": "kyc", "action": "review"},
    {"resource": "kyc", "action": "approve"},
    {"resource": "kyc", "action": "reject"},
    # admin surfaces
    {"resource": "catalogue", "action": "write"},
    {"resource": "inventory", "action": "write"},
    {"resource": "cms", "action": "write"},
    {"resource": "settings", "action": "write"},
    {"resource": "enquiries", "action": "manage"},
    {"resource": "enquiries", "action": "approve"},
    {"resource": "chat", "action": "manage"},
    {"resource": "analytics", "action": "read"},
    {"resource": "sales", "action": "read"},
    {"resource": "sales", "action": "manage"},
    {"resource": "audit", "action": "read"},
    {"resource": "hr", "action": "manage"},
    # platform ops (super-admin console) — admin role only
    {"resource": "platform", "action": "admin", "description": "Platform Ops super-admin console"},
]

ROLE_PERMISSIONS: dict[str, list[tuple[str, str]]] = {
    "customer": [("products", "read"), ("orders", "create"), ("orders", "read_own")],
    "clinician": [("products", "read"), ("orders", "create"), ("orders", "read_own")],
    "retailer": [("products", "read"), ("orders", "create"), ("orders", "read_own")],
    "sales": [
        ("products", "read"),
        ("orders", "read_assigned"),
        ("orders", "fulfil"),
        ("kyc", "review"),
        ("kyc", "approve"),
        ("kyc", "reject"),
        ("enquiries", "manage"),
        ("chat", "manage"),
        ("analytics", "read"),
        ("sales", "read"),
    ],
    "manager": [
        ("products", "read"),
        ("catalogue", "write"),
        ("cms", "write"),
        ("orders", "read_assigned"),
        ("orders", "read_all"),
        ("orders", "fulfil"),
        ("kyc", "review"),
        ("kyc", "approve"),
        ("kyc", "reject"),
        ("users", "read"),
        ("enquiries", "manage"),
        ("enquiries", "approve"),
        ("chat", "manage"),
        ("analytics", "read"),
        ("sales", "read"),
        ("sales", "manage"),
        ("audit", "read"),
        ("hr", "manage"),
    ],
    "admin": [(p["resource"], p["action"]) for p in PERMISSION_DEFS],
}


async def seed_roles_and_permissions(db) -> None:
    # Upsert permissions
    perm_lookup: dict[tuple[str, str], Permission] = {}
    for p in PERMISSION_DEFS:
        existing = (
            await db.execute(
                select(Permission).where(
                    Permission.resource == p["resource"], Permission.action == p["action"]
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            existing = Permission(
                resource=p["resource"],
                action=p["action"],
                description=p.get("description"),
            )
            db.add(existing)
            await db.flush()
        perm_lookup[(p["resource"], p["action"])] = existing

    # Upsert roles
    role_lookup: dict[str, Role] = {}
    for r in ROLE_DEFS:
        existing = (
            await db.execute(select(Role).where(Role.name == r["name"]))
        ).scalar_one_or_none()
        if existing is None:
            existing = Role(name=r["name"], description=r["description"])
            db.add(existing)
            await db.flush()
        role_lookup[r["name"]] = existing

    # Wire role→permission
    for role_name, perms in ROLE_PERMISSIONS.items():
        role = role_lookup[role_name]
        for resource, action in perms:
            perm = perm_lookup[(resource, action)]
            existing = (
                await db.execute(
                    select(RolePermission).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == perm.id,
                    )
                )
            ).scalar_one_or_none()
            if existing is None:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    log.info(
        "seed.roles",
        roles=len(ROLE_DEFS),
        permissions=len(PERMISSION_DEFS),
    )
