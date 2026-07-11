"""Authentication & session management.

All flows are async and rely on the SQLAlchemy `AsyncSession` passed in by
the FastAPI dependency `get_session`.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Final

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..logging import get_logger
from ..models.audit import AuditLog
from ..models.rbac import Permission, Role, RolePermission
from ..models.user import (
    Session as DbSession,
)
from ..models.user import (
    User,
    UserProfile,
    UserRole,
    UserStatus,
)
from ..security import (
    hash_password,
    hash_refresh_token,
    make_access_token,
    make_refresh_token,
    refresh_token_expiry,
    verify_password,
)

settings = get_settings()
log = get_logger("services.auth")

INVALID_CREDENTIALS: Final = "invalid email or password"


# --- Public API ------------------------------------------------------------


async def signup_user(
    db: AsyncSession,
    *,
    role: str,
    email: str,
    password: str,
    name: str,
    phone: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    cart_session_id: str | None = None,
) -> tuple[User, str, str, int]:
    """Create a user + profile + initial refresh session.

    Returns (user, access_token, refresh_token, access_ttl_seconds).
    """
    try:
        user_role = UserRole(role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"invalid role: {role}",
        ) from None

    # Self-signup is limited to customer/clinician/retailer in Phase 1.
    if user_role in (UserRole.sales, UserRole.manager, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="portal users are provisioned by admins, not self-signup",
        )

    # Clinicians and retailers need KYC before role-priced visibility unlocks.
    initial_status = (
        UserStatus.pending_kyc
        if user_role in (UserRole.clinician, UserRole.retailer)
        else UserStatus.active
    )

    user = User(
        email=email.lower().strip(),
        phone=phone,
        password_hash=hash_password(password),
        role=user_role,
        status=initial_status,
    )
    user.profile = UserProfile(full_name=name)
    db.add(user)

    try:
        await db.flush()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="email or phone already registered",
        ) from e

    access, refresh, ttl = await _issue_token_pair(db, user, ip=ip, user_agent=user_agent)
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="user.signup",
            entity_type="user",
            entity_id=str(user.id),
            payload={"role": user_role.value},
            ip=ip,
            user_agent=user_agent,
        )
    )
    if cart_session_id:
        # Local import avoids a circular dep at module load time.
        from . import cart as cart_svc
        await cart_svc.merge_session_cart_into_user(
            db, session_id=cart_session_id, user=user
        )
    await db.commit()
    log.info("user.signup", user_id=str(user.id), role=user_role.value)
    return user, access, refresh, ttl


async def login_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    ip: str | None = None,
    user_agent: str | None = None,
    cart_session_id: str | None = None,
) -> tuple[User, str, str, int]:
    result = await db.execute(
        select(User).where(User.email == email.lower().strip())
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS,
        )
    if user.status == UserStatus.suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="account suspended",
        )

    user.last_login_at = datetime.now(UTC)
    access, refresh, ttl = await _issue_token_pair(db, user, ip=ip, user_agent=user_agent)
    db.add(
        AuditLog(
            actor_user_id=user.id,
            action="user.login",
            entity_type="user",
            entity_id=str(user.id),
            payload={},
            ip=ip,
            user_agent=user_agent,
        )
    )
    if cart_session_id:
        from . import cart as cart_svc
        await cart_svc.merge_session_cart_into_user(
            db, session_id=cart_session_id, user=user
        )
    await db.commit()
    log.info("user.login", user_id=str(user.id))
    return user, access, refresh, ttl


async def refresh_session(
    db: AsyncSession,
    *,
    refresh_token: str,
    ip: str | None = None,
    user_agent: str | None = None,
) -> tuple[User, str, str, int]:
    """Rotate a refresh token. Detects reuse and burns all sessions if seen.

    Reuse detection is the critical security property:
      - The refresh token is hashed; we look up the matching session row.
      - If the row is already revoked, someone presented a stolen + previously
        used token. We revoke every active session for that user and return 401.
    """
    presented_hash = hash_refresh_token(refresh_token)
    result = await db.execute(
        select(DbSession).where(DbSession.refresh_token_hash == presented_hash)
    )
    sess = result.scalar_one_or_none()
    if sess is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid refresh token",
        )
    if sess.expires_at < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="refresh token expired",
        )
    if sess.revoked_at is not None:
        # Reuse detected — burn everything.
        await db.execute(
            update(DbSession)
            .where(DbSession.user_id == sess.user_id, DbSession.revoked_at.is_(None))
            .values(revoked_at=datetime.now(UTC))
        )
        db.add(
            AuditLog(
                actor_user_id=sess.user_id,
                action="security.refresh_reuse_detected",
                entity_type="session",
                entity_id=str(sess.id),
                payload={"all_sessions_revoked": True},
                ip=ip,
                user_agent=user_agent,
            )
        )
        await db.commit()
        log.warning(
            "security.refresh_reuse_detected",
            user_id=str(sess.user_id),
            session_id=str(sess.id),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="refresh token reuse detected — all sessions revoked",
        )

    user_result = await db.execute(select(User).where(User.id == sess.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or user.status == UserStatus.suspended:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user not available",
        )

    # Revoke the presented token, issue a new pair.
    sess.revoked_at = datetime.now(UTC)
    access, new_refresh, ttl = await _issue_token_pair(
        db, user, rotated_from=sess.id, ip=ip, user_agent=user_agent
    )
    await db.commit()
    log.info("auth.refresh", user_id=str(user.id), rotated_from=str(sess.id))
    return user, access, new_refresh, ttl


async def revoke_session(db: AsyncSession, *, refresh_token: str) -> None:
    """Logout — mark the session revoked."""
    presented_hash = hash_refresh_token(refresh_token)
    await db.execute(
        update(DbSession)
        .where(
            DbSession.refresh_token_hash == presented_hash,
            DbSession.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()


async def load_permissions(db: AsyncSession, user: User) -> list[str]:
    """Resolve permission strings (`resource:action`) for the user's role.

    Returns [] if the role has no permission rows seeded yet — handlers that
    rely on permissions should use the simple `require_role(...)` dep until
    Phase 6 wires Casbin.
    """
    stmt = (
        select(Permission.resource, Permission.action)
        .select_from(RolePermission)
        .join(Role, Role.id == RolePermission.role_id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .where(Role.name == user.role.value)
    )
    rows = (await db.execute(stmt)).all()
    return [f"{r.resource}:{r.action}" for r in rows]


# --- Internals ------------------------------------------------------------


async def _issue_token_pair(
    db: AsyncSession,
    user: User,
    *,
    rotated_from=None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> tuple[str, str, int]:
    permissions = await load_permissions(db, user)

    access = make_access_token(
        sub=str(user.id),
        role=user.role.value,
        kyc_status=user.status.value,
        permissions=permissions,
    )
    raw_refresh, refresh_hash = make_refresh_token()

    db.add(
        DbSession(
            user_id=user.id,
            refresh_token_hash=refresh_hash,
            user_agent=user_agent[:255] if user_agent else None,
            ip=ip,
            expires_at=refresh_token_expiry(),
            rotated_from=rotated_from,
        )
    )

    return access, raw_refresh, settings.access_token_ttl_min * 60
