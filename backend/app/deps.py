"""FastAPI dependencies — auth, RBAC, pagination, request metadata, cart session."""
from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Cookie, Depends, Header, HTTPException, Query, Request, Response, status
from sqlalchemy import select

from .config import get_settings
from .db import DbSession
from .models.user import User, UserStatus
from .redis import get_redis, get_role_permission_version
from .security import decode_access_token

CART_COOKIE = "nethrasap.session"
CART_COOKIE_MAX_AGE = 30 * 24 * 60 * 60  # 30 days


# --- Pagination ------------------------------------------------------------


@dataclass(slots=True)
class Pagination:
    limit: int
    offset: int


def pagination(
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Pagination:
    return Pagination(limit=limit, offset=offset)


Paged = Annotated[Pagination, Depends(pagination)]


# --- Auth -----------------------------------------------------------------


def _extract_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


async def _jti_denied(jti: str | None) -> bool:
    """True if the token's jti was revoked (logout). Fail-open in dev/test —
    Redis being down must not lock the API out locally; in production an
    unreachable denylist must not let revoked tokens through."""
    if not jti:
        return False
    try:
        return bool(await get_redis().exists(f"jti:deny:{jti}"))
    except Exception:
        if get_settings().environment in ("dev", "test"):
            return False
        raise


async def _user_from_token(db, token: str) -> User | None:
    try:
        payload = decode_access_token(token)
    except Exception:
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    try:
        user_id = uuid.UUID(str(sub))
    except ValueError:
        # Attacker-controlled sub (e.g. a phone-proof token) must be a clean
        # auth failure, never a 500 from the UUID cast in the query.
        return None
    if await _jti_denied(payload.get("jti")):
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def current_user(
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    """Required-auth dependency. Raises 401 if there is no valid bearer token."""
    token = _extract_bearer(authorization)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await _user_from_token(db, token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.status == UserStatus.suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="account suspended",
        )
    return user


async def optional_user(
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> User | None:
    """Optional-auth dependency. Returns None if no/invalid token; never raises."""
    token = _extract_bearer(authorization)
    if token is None:
        return None
    return await _user_from_token(db, token)


CurrentUser = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]


# --- Role & permission guards ----------------------------------------------


def require_role(*roles: str):
    """Create a dependency that requires the current user to have one of `roles`.

    Prefer `require_permission` for staff endpoints — role checks are only for
    coarse gates where the permission model genuinely doesn't apply.
    """

    async def _dep(user: CurrentUser) -> User:
        if user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"requires role: {', '.join(roles)}",
            )
        return user

    return _dep


def permission_matches(granted: list[str], needed: str) -> bool:
    """`resource:action` matching with wildcards: `*` and `resource:*`."""
    if "*" in granted or needed in granted:
        return True
    resource = needed.split(":", 1)[0]
    return f"{resource}:*" in granted


async def _token_claims(authorization: str | None) -> dict[str, Any]:
    token = _extract_bearer(authorization)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return decode_access_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


def require_permission(needed: str):
    """Dependency enforcing a `resource:action` permission.

    Permissions ride in the JWT `perm` claim (resolved at login). The claim is
    trusted only while the role's permission *version* matches Redis — editing
    a role bumps the version, instantly invalidating stale tokens (401 forces
    a refresh, which re-resolves permissions).
    """

    async def _dep(
        db: DbSession,
        authorization: Annotated[str | None, Header()] = None,
    ) -> User:
        claims = await _token_claims(authorization)

        if await _jti_denied(claims.get("jti")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        current_pv = await get_role_permission_version(str(claims.get("role", "")))
        if int(claims.get("pv", 0)) != current_pv:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="permissions changed — refresh your session",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not permission_matches(list(claims.get("perm", [])), needed):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"requires permission: {needed}",
            )

        try:
            user_id = uuid.UUID(str(claims["sub"]))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from None
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
        if user.status == UserStatus.suspended:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="account suspended",
            )
        return user

    return _dep


# --- Request metadata ------------------------------------------------------


def client_metadata(request: Request) -> dict[str, str | None]:
    """Extract useful metadata for audit logs."""
    return {
        "ip": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    }


ClientMeta = Annotated[dict, Depends(client_metadata)]


# --- Cart session cookie -------------------------------------------------


def ensure_cart_session(
    response: Response,
    nethrasap_session: Annotated[str | None, Cookie(alias=CART_COOKIE)] = None,
) -> str:
    """Issue an HTTP-only session cookie for anon cart persistence.

    If the request already has the cookie, return its value untouched. If not,
    mint a fresh 32-char token, set the cookie on the response, and return it.
    """
    if nethrasap_session and len(nethrasap_session) >= 16:
        return nethrasap_session
    token = secrets.token_urlsafe(24)
    response.set_cookie(
        key=CART_COOKIE,
        value=token,
        max_age=CART_COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=get_settings().cookie_secure,
        path="/",
    )
    return token


CartSession = Annotated[str, Depends(ensure_cart_session)]
