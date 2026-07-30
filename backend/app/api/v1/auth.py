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
from fastapi import APIRouter, Cookie, Header, HTTPException, Response, status

from ...config import get_settings
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

# --- Auth cookies -----------------------------------------------------------
# Browsers reach the API same-origin (Next.js rewrite proxy), so cookies set
# here bind to the app origin. `nethra_rt` carries the refresh token and is
# scoped to this router's path; `nethra_auth` is a readable role hint for the
# Next middleware only — the API NEVER trusts it.

RT_COOKIE = "nethra_rt"
ROLE_COOKIE = "nethra_auth"
AUTH_COOKIE_PATH = "/api/v1/auth"


def _to_token_pair(access: str, refresh: str, ttl: int) -> TokenPair:
    return TokenPair(access_token=access, refresh_token=refresh, expires_in=ttl)


def _set_auth_cookies(response: Response, *, refresh_token: str, role: str) -> None:
    settings = get_settings()
    max_age = settings.refresh_token_ttl_days * 24 * 60 * 60
    response.set_cookie(
        key=RT_COOKIE,
        value=refresh_token,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path=AUTH_COOKIE_PATH,
    )
    response.set_cookie(
        key=ROLE_COOKIE,
        value=role,
        max_age=max_age,
        httponly=False,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    secure = get_settings().cookie_secure
    response.delete_cookie(
        RT_COOKIE, path=AUTH_COOKIE_PATH, httponly=True, samesite="lax", secure=secure
    )
    response.delete_cookie(ROLE_COOKIE, path="/", samesite="lax", secure=secure)


def _resolve_refresh_token(
    cookie_token: str | None, payload: RefreshRequest | None
) -> str:
    """Cookie first, JSON body as the pre-cookie fallback; 401 when neither."""
    token = cookie_token or (payload.refresh_token if payload else None)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing refresh token")
    return token


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
    response: Response,
    cart_session_id: Annotated[str | None, Cookie(alias=CART_COOKIE)] = None,
) -> TokenPair | dict:
    """Verify a code. `login` purpose returns a TokenPair directly; `signup`
    and `reset` return an `otp_token` proof for the follow-up call."""
    allowed = await rate_limit(
        f"verify:phone:{payload.phone}", limit=10, window_seconds=15 * 60
    ) and await rate_limit(f"verify:ip:{meta.get('ip')}", limit=10, window_seconds=15 * 60)
    if not allowed:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many attempts")
    proof = await otp_svc.verify_otp(
        db, phone=payload.phone, purpose=OtpPurpose(payload.purpose), code=payload.code
    )
    if payload.purpose == "login":
        user, access, refresh, ttl = await auth_svc.login_with_phone_proof(
            db,
            phone=payload.phone,
            ip=meta.get("ip"),
            user_agent=meta.get("user_agent"),
            cart_session_id=cart_session_id,
        )
        _set_auth_cookies(response, refresh_token=refresh, role=user.role.value)
        return _to_token_pair(access, refresh, ttl)
    return {"otp_token": proof, "expires_in": PHONE_PROOF_TTL_MIN * 60}


@router.post("/signup", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    db: DbSession,
    meta: ClientMeta,
    response: Response,
    cart_session_id: Annotated[str | None, Cookie(alias=CART_COOKIE)] = None,
) -> TokenPair:
    if not await rate_limit(f"signup:ip:{meta.get('ip')}", limit=5, window_seconds=3600):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many requests")
    phone = _proven_phone(payload.otp_token, purpose="signup")
    user, access, refresh, ttl = await auth_svc.signup_user(
        db,
        role=payload.role,
        phone=phone,
        password=payload.password,
        name=payload.name,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
        cart_session_id=cart_session_id,
    )
    _set_auth_cookies(response, refresh_token=refresh, role=user.role.value)
    return _to_token_pair(access, refresh, ttl)


@router.post("/login", response_model=TokenPair)
async def login(
    payload: LoginRequest,
    db: DbSession,
    meta: ClientMeta,
    response: Response,
    cart_session_id: Annotated[str | None, Cookie(alias=CART_COOKIE)] = None,
) -> TokenPair:
    if not await rate_limit(f"login:ip:{meta.get('ip')}", limit=20, window_seconds=15 * 60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many attempts")
    if not await rate_limit(f"login:phone:{payload.phone}", limit=10, window_seconds=15 * 60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many attempts")
    user, access, refresh, ttl = await auth_svc.login_user(
        db,
        phone=payload.phone,
        password=payload.password,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
        cart_session_id=cart_session_id,
    )
    _set_auth_cookies(response, refresh_token=refresh, role=user.role.value)
    return _to_token_pair(access, refresh, ttl)


@router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def password_reset(payload: PasswordResetRequest, db: DbSession, meta: ClientMeta) -> Response:
    if not await rate_limit(f"reset:ip:{meta.get('ip')}", limit=5, window_seconds=3600):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many requests")
    phone = _proven_phone(payload.otp_token, purpose="reset")
    if not await rate_limit(f"reset:phone:{phone}", limit=5, window_seconds=3600):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many requests")
    await auth_svc.reset_password(
        db,
        phone=phone,
        new_password=payload.new_password,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    db: DbSession,
    meta: ClientMeta,
    response: Response,
    payload: RefreshRequest | None = None,
    nethra_rt: Annotated[str | None, Cookie()] = None,
) -> TokenPair:
    if not await rate_limit(f"refresh:ip:{meta.get('ip')}", limit=60, window_seconds=15 * 60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many requests")
    refresh_token = _resolve_refresh_token(nethra_rt, payload)
    user, access, new_refresh, ttl = await auth_svc.refresh_session(
        db,
        refresh_token=refresh_token,
        ip=meta.get("ip"),
        user_agent=meta.get("user_agent"),
    )
    _set_auth_cookies(response, refresh_token=new_refresh, role=user.role.value)
    return _to_token_pair(access, new_refresh, ttl)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def logout(
    db: DbSession,
    payload: RefreshRequest | None = None,
    nethra_rt: Annotated[str | None, Cookie()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> Response:
    refresh_token = _resolve_refresh_token(nethra_rt, payload)
    # Best-effort jti extraction: logout must succeed even with an expired or
    # missing access token — the refresh session is revoked regardless.
    access_jti: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        try:
            from ...security import decode_access_token

            access_jti = decode_access_token(authorization.split(" ", 1)[1]).get("jti")
        except Exception:
            access_jti = None
    await auth_svc.revoke_session(
        db, refresh_token=refresh_token, access_jti=access_jti
    )
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_auth_cookies(response)
    return response


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
