"""Staff provisioning — the admin's console for portal accounts.

Portal roles (sales / manager / admin) are **provisioned, never self-signup**:
`SignupRequest` only accepts customer/clinician/retailer. This module is the
sanctioned way those accounts come into existence, so the first admin (created
by `scripts.bootstrap_admin` from env) can staff the rest of the team.

Lockout guards are the point of most of the code here: an admin must not be
able to strand the platform with no way back in — no demoting or suspending
yourself, and never removing the last active admin.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..logging import get_logger
from ..models.audit import AuditLog
from ..models.user import User, UserProfile, UserRole, UserStatus
from ..phone import normalize_phone
from ..redis import bump_role_permission_version
from ..security import hash_password

log = get_logger("services.admin_users")

STAFF_ROLES = (UserRole.sales, UserRole.manager, UserRole.admin)
MIN_PASSWORD_LEN = 10


async def _audit(
    db: AsyncSession, actor: User, action: str, entity_id: str, payload: dict[str, Any]
) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action=action,
            entity_type="user",
            entity_id=entity_id,
            payload=payload,
        )
    )


def _serialise(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "phone": user.phone,
        "name": user.profile.full_name if user.profile else None,
        "role": user.role.value,
        "status": user.status.value,
        "phone_verified": user.phone_verified_at is not None,
        "last_login_at": user.last_login_at,
        "created_at": user.created_at,
    }


async def _load(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = (
        await db.execute(
            select(User).options(selectinload(User.profile)).where(User.id == user_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    return user


async def _active_admin_count(db: AsyncSession, *, excluding: uuid.UUID | None = None) -> int:
    stmt = select(func.count()).select_from(User).where(
        User.role == UserRole.admin, User.status == UserStatus.active
    )
    if excluding is not None:
        stmt = stmt.where(User.id != excluding)
    return (await db.execute(stmt)).scalar_one()


async def list_users(
    db: AsyncSession,
    *,
    role: str | None = None,
    status_filter: str | None = None,
    q: str | None = None,
    staff_only: bool = True,
    limit: int = 50,
    offset: int = 0,
) -> tuple[int, list[dict[str, Any]]]:
    """Accounts for the team console. Defaults to staff — the customer base is
    large and is browsed from the orders/verifications surfaces instead."""
    base = select(User).outerjoin(UserProfile, UserProfile.user_id == User.id)
    if staff_only:
        base = base.where(User.role.in_(STAFF_ROLES))
    if role:
        try:
            base = base.where(User.role == UserRole(role))
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid role: {role}") from None
    if status_filter:
        try:
            base = base.where(User.status == UserStatus(status_filter))
        except ValueError:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"invalid status: {status_filter}"
            ) from None
    if q:
        term = f"%{q.strip()}%"
        base = base.where(or_(User.phone.ilike(term), UserProfile.full_name.ilike(term)))

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        (
            await db.execute(
                base.options(selectinload(User.profile))
                .order_by(User.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return total, [_serialise(u) for u in rows]


async def create_staff(
    db: AsyncSession,
    actor: User,
    *,
    phone: str,
    name: str,
    role: str,
    password: str,
) -> dict[str, Any]:
    """Provision a portal account. Staff sign in with phone + password; the
    account is created phone-unverified (OTP verification happens later, and is
    unavailable at all while OTP_ENABLED=false pre-DLT)."""
    try:
        user_role = UserRole(role)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid role: {role}") from None
    if user_role not in STAFF_ROLES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "only sales, manager and admin accounts are provisioned here — "
            "customers sign themselves up",
        )
    if len(password) < MIN_PASSWORD_LEN:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"password must be at least {MIN_PASSWORD_LEN} characters",
        )

    norm = normalize_phone(phone)
    if (await db.execute(select(User.id).where(User.phone == norm))).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, f"{norm} already has an account")

    user = User(
        phone=norm,
        password_hash=hash_password(password),
        role=user_role,
        status=UserStatus.active,
    )
    user.profile = UserProfile(full_name=name.strip())
    db.add(user)
    await db.flush()
    await _audit(db, actor, "user.staff_created", str(user.id), {"role": user_role.value, "phone": norm})
    await db.commit()
    log.info("staff.created", user_id=str(user.id), role=user_role.value, by=str(actor.id))
    return _serialise(await _load(db, user.id))


async def update_role(
    db: AsyncSession, actor: User, *, user_id: uuid.UUID, role: str
) -> dict[str, Any]:
    user = await _load(db, user_id)
    try:
        new_role = UserRole(role)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid role: {role}") from None
    if new_role not in STAFF_ROLES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "portal accounts can only hold staff roles"
        )
    if user.id == actor.id and new_role != user.role:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "you can't change your own role — ask another admin"
        )
    # Losing the last admin would leave nobody able to grant the role back.
    if (
        user.role == UserRole.admin
        and new_role != UserRole.admin
        and await _active_admin_count(db, excluding=user.id) == 0
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "this is the last admin — promote someone else first")

    previous = user.role.value
    user.role = new_role
    await _audit(db, actor, "user.role_changed", str(user.id), {"from": previous, "to": new_role.value})
    await db.commit()
    # `perm`/`pv` claims are cached per ROLE in the JWT. Bump both sides so the
    # stale token 401s on the next call; the client's refresh re-reads the user
    # and re-resolves permissions, so the change lands without a manual logout.
    #
    # Best-effort: the role is already committed, so a Redis blip must not turn
    # a successful change into a 500. Worst case the old token keeps its stale
    # permissions until it expires (15 min).
    for role_name in (previous, new_role.value):
        try:
            await bump_role_permission_version(role_name)
        except Exception:
            log.warning("staff.pv_bump_failed", role=role_name, user_id=str(user.id))
    log.info("staff.role_changed", user_id=str(user.id), to=new_role.value, by=str(actor.id))
    return _serialise(await _load(db, user.id))


async def set_status(
    db: AsyncSession, actor: User, *, user_id: uuid.UUID, suspended: bool
) -> dict[str, Any]:
    user = await _load(db, user_id)
    if user.id == actor.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "you can't suspend your own account")
    if (
        suspended
        and user.role == UserRole.admin
        and await _active_admin_count(db, excluding=user.id) == 0
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "this is the last active admin")

    user.status = UserStatus.suspended if suspended else UserStatus.active
    await _audit(db, actor, "user.suspended" if suspended else "user.reactivated", str(user.id), {})
    await db.commit()
    log.info("staff.status", user_id=str(user.id), suspended=suspended, by=str(actor.id))
    return _serialise(await _load(db, user.id))


async def reset_password(
    db: AsyncSession, actor: User, *, user_id: uuid.UUID, password: str
) -> dict[str, Any]:
    """Set a new password for a staff account (they change it after signing in).
    Existing refresh sessions are left alone deliberately — revoking them is a
    separate 'sign out everywhere' action, not part of handing over a password."""
    if len(password) < MIN_PASSWORD_LEN:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"password must be at least {MIN_PASSWORD_LEN} characters",
        )
    user = await _load(db, user_id)
    user.password_hash = hash_password(password)
    await _audit(db, actor, "user.password_reset", str(user.id), {})
    await db.commit()
    log.info("staff.password_reset", user_id=str(user.id), by=str(actor.id))
    return _serialise(user)
