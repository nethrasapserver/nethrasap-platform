"""Auth endpoints — signup, login, refresh, logout, me."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Response, status

from ...db import DbSession
from ...deps import CART_COOKIE, ClientMeta, CurrentUser
from ...schemas.auth import (
    LoginRequest,
    MeResponse,
    RefreshRequest,
    SignupRequest,
    TokenPair,
    UserProfileResponse,
)
from ...services import auth as auth_svc

router = APIRouter()


def _to_token_pair(access: str, refresh: str, ttl: int) -> TokenPair:
    return TokenPair(access_token=access, refresh_token=refresh, expires_in=ttl)


@router.post("/signup", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    db: DbSession,
    meta: ClientMeta,
    cart_session_id: Annotated[str | None, Cookie(alias=CART_COOKIE)] = None,
) -> TokenPair:
    _user, access, refresh, ttl = await auth_svc.signup_user(
        db,
        role=payload.role,
        email=payload.email,
        password=payload.password,
        name=payload.name,
        phone=payload.phone,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
        cart_session_id=cart_session_id,
    )
    return _to_token_pair(access, refresh, ttl)


@router.post("/login", response_model=TokenPair)
async def login(
    payload: LoginRequest,
    db: DbSession,
    meta: ClientMeta,
    cart_session_id: Annotated[str | None, Cookie(alias=CART_COOKIE)] = None,
) -> TokenPair:
    _user, access, refresh, ttl = await auth_svc.login_user(
        db,
        email=payload.email,
        password=payload.password,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
        cart_session_id=cart_session_id,
    )
    return _to_token_pair(access, refresh, ttl)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: DbSession, meta: ClientMeta) -> TokenPair:
    _user, access, new_refresh, ttl = await auth_svc.refresh_session(
        db,
        refresh_token=payload.refresh_token,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
    )
    return _to_token_pair(access, new_refresh, ttl)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def logout(payload: RefreshRequest, db: DbSession) -> Response:
    await auth_svc.revoke_session(db, refresh_token=payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=MeResponse)
async def me(user: CurrentUser, db: DbSession) -> MeResponse:
    permissions = await auth_svc.load_permissions(db, user)
    profile = (
        UserProfileResponse(
            full_name=user.profile.full_name,
            avatar_url=user.profile.avatar_url,
            attributes=user.profile.attributes or {},
        )
        if user.profile
        else None
    )
    return MeResponse(
        id=user.id,
        email=user.email,
        phone=user.phone,
        role=user.role.value,  # type: ignore[arg-type]
        status=user.status.value,  # type: ignore[arg-type]
        email_verified=user.email_verified_at is not None,
        last_login_at=user.last_login_at,
        profile=profile,
        permissions=permissions,
    )
