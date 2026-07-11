"""RBAC — Role, Permission, RolePermission.

Phase 1 ships a minimal but real RBAC layer:

- `roles` mirrors `UserRole` enum values (customer/clinician/retailer/sales/
  manager/admin) and stores descriptive metadata.
- `permissions` is a list of `resource:action` strings.
- `role_permissions` is the many-to-many join.

Casbin (Phase 6) will read these tables to make decisions; for now,
permission checks happen via simple role-based guards in `deps.py`.
"""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_at, updated_at, uuid_pk


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[uuid_pk]
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    permissions: Mapped[list[RolePermission]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[uuid_pk]
    resource: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    __table_args__ = (
        UniqueConstraint("resource", "action", name="uq_permissions_resource_action"),
    )


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id: Mapped[uuid_pk]
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[created_at]

    role: Mapped[Role] = relationship(back_populates="permissions")
    permission: Mapped[Permission] = relationship()

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permissions_role_id_permission_id"),
    )
