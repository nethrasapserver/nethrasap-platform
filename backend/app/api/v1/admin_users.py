"""Team console — provisioning portal (staff) accounts.

Staff never self-register: `/auth/signup` accepts customer/clinician/retailer
only. The first admin comes from `scripts.bootstrap_admin` (env vars, run in
the deploy hook); every other staff account is created here.
"""
from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ...db import DbSession
from ...deps import Paged, require_permission
from ...models.user import User
from ...services import admin_users as svc

router = APIRouter()

# Reading the team is a manager-level view; creating/changing accounts is
# admin-only (see rbac_data: users:create / users:update_role / users:suspend).
TeamReader = Annotated[User, Depends(require_permission("users:read"))]
UserCreator = Annotated[User, Depends(require_permission("users:create"))]
RoleChanger = Annotated[User, Depends(require_permission("users:update_role"))]
Suspender = Annotated[User, Depends(require_permission("users:suspend"))]

StaffRole = Literal["sales", "manager", "admin"]


class StaffCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    phone: str = Field(min_length=8, max_length=20)
    name: str = Field(min_length=2, max_length=120)
    role: StaffRole
    password: str = Field(min_length=10, max_length=128)


class RoleUpdate(BaseModel):
    role: StaffRole


class StatusUpdate(BaseModel):
    suspended: bool


class PasswordReset(BaseModel):
    password: str = Field(min_length=10, max_length=128)


@router.get("/admin/users")
async def list_users(
    db: DbSession,
    _actor: TeamReader,
    page: Paged,
    role: Annotated[str | None, Query()] = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=80, description="phone or name")] = None,
    staff_only: Annotated[bool, Query()] = True,
) -> dict:
    total, items = await svc.list_users(
        db,
        role=role,
        status_filter=status_filter,
        q=q,
        staff_only=staff_only,
        limit=page.limit,
        offset=page.offset,
    )
    return {"total": total, "items": items}


@router.post("/admin/users", status_code=201)
async def create_staff(payload: StaffCreate, db: DbSession, actor: UserCreator) -> dict:
    return await svc.create_staff(
        db,
        actor,
        phone=payload.phone,
        name=payload.name,
        role=payload.role,
        password=payload.password,
    )


@router.patch("/admin/users/{user_id}/role")
async def update_role(user_id: UUID, payload: RoleUpdate, db: DbSession, actor: RoleChanger) -> dict:
    return await svc.update_role(db, actor, user_id=user_id, role=payload.role)


@router.patch("/admin/users/{user_id}/status")
async def set_status(user_id: UUID, payload: StatusUpdate, db: DbSession, actor: Suspender) -> dict:
    return await svc.set_status(db, actor, user_id=user_id, suspended=payload.suspended)


@router.post("/admin/users/{user_id}/password")
async def reset_password(
    user_id: UUID, payload: PasswordReset, db: DbSession, actor: UserCreator
) -> dict:
    return await svc.reset_password(db, actor, user_id=user_id, password=payload.password)
