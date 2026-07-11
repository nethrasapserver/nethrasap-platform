"""Auth endpoints — phone-first: OTP request/verify, signup, login, reset.

Flow map:
  signup:  POST /auth/otp/request(purpose=signup) -> POST /auth/otp/verify
           -> POST /auth/signup {otp_token, ...}          => TokenPair
  login:   POST /auth/login {phone, password}             => TokenPair
      or:  POST /auth/otp/request(purpose=login) -> POST /auth/otp/verify
           (login purpose returns the TokenPair directly — no second call)
  reset:   POST /auth/otp/request(purpose=reset) -> POST /auth/otp/verify
           -> POST /auth/password/reset {otp_token, new_password}
"""
from __future__ import annotations

from typing import Annotated

import jwt as pyjwt
from fastapi import APIRouter, Cookie, HTTPException, Response, status

from ...db import DbSession
from ...deps import CART_COOKIE, ClientMeta, CurrentUser
from ...models.otp import OtpPurpose
from ...redis import rate_limit
from ...schemas.auth import (
    LoginRequest,
    MeResponse,
    OtpRequestRequest,
    OtpVerifyRequest,
    PasswordResetRequest,
    RefreshRequest,
    SignupRequest,
    TokenPair,
    UserProfileResponse,
)
from ...security import PHONE_PROOF_TTL_MIN, decode_phone_proof_token
from ...services import auth as auth_svc
from ...services import otp as otp_svc

router = APIRouter()


def _to_token_pair(access: str, refresh: str, ttl: int) -> TokenPair:
    return TokenPair(access_token=access, refresh_token=refresh, expires_in=ttl)


def _proven_phone(otp_token: str, *, purpose: str) -> str:
    try:
        return decode_phone_proof_token(otp_token, expected_purpose=purpose)
    except pyjwt.PyJWTError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "invalid or expired otp token"
        ) from None


@router.post("/otp/request", status_code=status.HTTP_202_ACCEPTED)
async def otp_request(payload: OtpRequestRequest, db: DbSession, meta: ClientMeta) -> dict:
    if not await rate_limit(f"otp:ip:{meta.get('ip')}", limit=10, window_seconds=15 * 60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many requests")
    await otp_svc.request_otp(db, phone=payload.phone, purpose=OtpPurpose(payload.purpose))
    return {"detail": "code sent"}


@router.post("/otp/verify")
async def otp_verify(
    payload: OtpVerifyRequest,
    db: DbSession,
    meta: ClientMeta,
    cart_session_id: Annotated[str | None, Cookie(alias=CART_COOKIE)] = None,
) -> TokenPair | dict:
    """Verify a code. `login` purpose returns a TokenPair directly; `signup`
    and `reset` return an `otp_token` proof for the follow-up call."""
    proof = await otp_svc.verify_otp(
        db, phone=payload.phone, purpose=OtpPurpose(payload.purpose), code=payload.code
    )
    if payload.purpose == "login":
        _user, access, refresh, ttl = await auth_svc.login_with_phone_proof(
            db,
            phone=payload.phone,
            ip=meta.get("ip"),
            user_agent=meta.get("user_agent"),
            cart_session_id=cart_session_id,
        )
        return _to_token_pair(access, refresh, ttl)
    return {"otp_token": proof, "expires_in": PHONE_PROOF_TTL_MIN * 60}


@router.post("/signup", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    db: DbSession,
    meta: ClientMeta,
    cart_session_id: Annotated[str | None, Cookie(alias=CART_COOKIE)] = None,
) -> TokenPair:
    phone = _proven_phone(payload.otp_token, purpose="signup")
    _user, access, refresh, ttl = await auth_svc.signup_user(
        db,
        role=payload.role,
        phone=phone,
        password=payload.password,
        name=payload.name,
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
    if not await rate_limit(f"login:ip:{meta.get('ip')}", limit=20, window_seconds=15 * 60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many attempts")
    _user, access, refresh, ttl = await auth_svc.login_user(
        db,
        phone=payload.phone,
        password=payload.password,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
        cart_session_id=cart_session_id,
    )
    return _to_token_pair(access, refresh, ttl)


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def password_reset(payload: PasswordResetRequest, db: DbSession, meta: ClientMeta) -> Response:
    phone = _proven_phone(payload.otp_token, purpose="reset")
    await auth_svc.reset_password(
        db,
        phone=phone,
        new_password=payload.new_password,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
        phone=user.phone,
        role=user.role.value,
        status=user.status.value,
        phone_verified=user.phone_verified_at is not None,
        last_login_at=user.last_login_at,
        profile=profile,
        permissions=permissions,
    )
