"""Test fixtures.

Strategy:
- Spin up the schema once per test session against TEST_DATABASE_URL.
- Each test runs inside a SAVEPOINT so all writes roll back at teardown.
- The FastAPI dependency `get_session` is overridden to use the test session.
"""
from __future__ import annotations

# Ensure config sees the test DB before anything else imports app.config.
import asyncio
import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest_asyncio
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

os.environ["ENVIRONMENT"] = "test"
_test_url = os.environ.get("TEST_DATABASE_URL")
if not _test_url:
    raise RuntimeError(
        "TEST_DATABASE_URL is required to run tests. "
        "Create a separate database (Neon branch, local Postgres, etc.) "
        "and set TEST_DATABASE_URL in your environment."
    )
# Force the app to use the test DB — never read the dev DB during tests.
os.environ["DATABASE_URL"] = _test_url
os.environ.setdefault("JWT_SECRET", "test-secret-please-do-not-use-in-prod-32-chars")
# The suite exercises the stubbed gateway flows (UPI + webhooks) end-to-end,
# so every method is force-enabled here regardless of the developer's .env;
# production defaults to COD-only. The gating logic itself is covered in
# test_saved_and_payment_methods.py (which overrides settings per-test).
os.environ["PAYMENT_METHODS_ENABLED"] = "cod,upi,card,netbanking,wallet"

from datetime import UTC  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import _normalise_url, get_session  # noqa: E402
from app.integrations.sms import ConsoleSmsProvider, get_provider  # noqa: E402

# Work around a forward-ref bug in app.observability (read-only source): the
# GET /metrics route is annotated `-> Response` while the module uses
# `from __future__ import annotations`, yet Response is imported only *inside*
# setup_metrics(). FastAPI resolves the return annotation against the module's
# globals at route-build time, where the name is absent, so create_app() raises
# `PydanticUndefinedAnnotation: name 'Response' is not defined` whenever metrics
# are enabled. Exposing the name at module scope before create_app() runs lets
# the app boot with metrics on, so the observability suite can hit /metrics.
# (Proper fix belongs in app/observability.py: hoist the Response import.)
import app.observability as _observability  # noqa: E402
from fastapi import Response as _Response  # noqa: E402

_observability.Response = _Response

from app.main import app  # noqa: E402

BACKEND_ROOT = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_ROOT / "alembic.ini"

# --- Phone-first auth helpers (shared by every test module) -----------------


def phone_for(ident: str) -> str:
    """Deterministic unique test phone for any string identifier."""
    import hashlib

    digits = int(hashlib.sha256(ident.encode()).hexdigest(), 16) % 10**9
    return f"+919{digits:09d}"


def last_otp_for(phone: str) -> str:
    """Read the most recent OTP sent to `phone` from the console SMS outbox."""
    provider = get_provider()
    assert isinstance(provider, ConsoleSmsProvider), "tests require SMS_PROVIDER=console"
    messages = provider.outbox.get(phone)
    assert messages, f"no SMS sent to {phone}"
    return messages[-1].split(" ", 1)[0]


async def get_otp_token(client, phone: str, purpose: str) -> str:
    """Run request→verify for `purpose` and return the proof token."""
    r = await client.post("/api/v1/auth/otp/request", json={"phone": phone, "purpose": purpose})
    assert r.status_code == 202, r.text
    r = await client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": phone, "purpose": purpose, "code": last_otp_for(phone)},
    )
    assert r.status_code == 200, r.text
    return r.json()["otp_token"]


async def signup(
    client,
    phone: str,
    *,
    role: str = "customer",
    password: str = "Strongp@ss123",
    name: str | None = None,
):
    """Full phone-first signup (OTP request → verify → signup). Returns the
    httpx response from POST /auth/signup."""
    otp_token = await get_otp_token(client, phone, "signup")
    return await client.post(
        "/api/v1/auth/signup",
        json={
            "role": role,
            "otp_token": otp_token,
            "password": password,
            "name": name or f"User {phone[-4:]}",
        },
    )


async def signup_token(
    client,
    phone: str,
    *,
    role: str = "customer",
    password: str = "Strongp@ss123",
    name: str | None = None,
) -> str:
    resp = await signup(client, phone, role=role, password=password, name=name)
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


def _engine_kwargs() -> tuple[str, dict]:
    settings = get_settings()
    url, connect_args = _normalise_url(settings.database_url)
    return url, connect_args


def _alembic_config() -> Config:
    """Alembic Config that finds the scripts regardless of the process CWD.

    env.py injects the DB URL from settings (already pointed at the test DB by
    the os.environ setup above), so no URL needs setting here — but we anchor
    `script_location` to an absolute path so `command.upgrade` works no matter
    where pytest is invoked from.
    """
    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    return cfg


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def _schema():
    """Build the schema once per session by running the real migration chain.

    We upgrade to head with Alembic rather than `Base.metadata.create_all` so the
    tests exercise the exact DDL production gets — triggers, sequences, the
    warehouse seed and every server-default/constraint alignment included. This
    is what keeps model↔migration drift from silently creeping back: if a
    migration stops matching the models, `alembic check` (run in CI) fails and
    the suite runs against the true schema.

    env.py drives migrations with `asyncio.run()`, which cannot be nested inside
    pytest's running event loop, so the upgrade runs in a worker thread.
    """
    url, connect_args = _engine_kwargs()
    # Start every session from a pristine schema (drops tables, enum types,
    # triggers, sequences and the pgcrypto extension — migration 0001 recreates
    # the extension, so nothing else needs pre-seeding here).
    engine = create_async_engine(url, echo=False, connect_args=connect_args)
    async with engine.begin() as conn:
        await conn.exec_driver_sql("DROP SCHEMA public CASCADE")
        await conn.exec_driver_sql("CREATE SCHEMA public")
    await engine.dispose()

    # Run the migrations off the event loop (env.py calls asyncio.run()).
    await asyncio.to_thread(command.upgrade, _alembic_config(), "head")
    yield


@pytest_asyncio.fixture
async def _session_factory(_schema):
    """One connection + outer transaction per test; rolled back at teardown.

    Sessions created from this factory join the outer transaction via
    SAVEPOINTs, so service-level `commit()` calls release a savepoint instead
    of committing for real — every test leaves the database untouched.

    A fresh engine per test keeps every asyncpg connection on the test's own
    event loop (pytest-asyncio uses one loop per test function).
    """
    from sqlalchemy.pool import NullPool

    url, connect_args = _engine_kwargs()
    engine = create_async_engine(url, echo=False, poolclass=NullPool, connect_args=connect_args)
    async with engine.connect() as conn:
        trans = await conn.begin()
        factory = async_sessionmaker(
            bind=conn,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        yield factory
        await trans.rollback()
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(_session_factory) -> AsyncIterator[AsyncSession]:
    """Session for direct fixture/seed access within the test transaction."""
    async with _session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(_session_factory) -> AsyncIterator[AsyncClient]:
    """HTTP client whose every request gets a FRESH session (like production),
    all inside the same rolled-back test transaction."""

    async def _override() -> AsyncIterator[AsyncSession]:
        async with _session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_session, None)


STAFF_PASSWORD = "Staff@Pass123"
STAFF_PHONES = {"sales": "+919700000001", "manager": "+919700000002", "admin": "+919700000003"}

_STAFF_PERMS = {
    "sales": [
        ("kyc", "review"), ("kyc", "approve"), ("kyc", "reject"),
        ("orders", "fulfil"), ("enquiries", "manage"), ("chat", "manage"),
        ("analytics", "read"), ("sales", "read"),
    ],
    "manager": [
        ("kyc", "review"), ("kyc", "approve"), ("kyc", "reject"),
        ("orders", "fulfil"), ("enquiries", "manage"), ("enquiries", "approve"), ("chat", "manage"), ("cms", "write"),
        ("catalogue", "write"),
        ("analytics", "read"), ("sales", "read"), ("sales", "manage"), ("audit", "read"),
    ],
    "admin": [
        ("kyc", "review"),
        ("kyc", "approve"),
        ("kyc", "reject"),
        ("catalogue", "write"),
        ("inventory", "write"),
        ("cms", "write"),
        ("settings", "write"),
        ("orders", "fulfil"),
        ("orders", "refund"),
        ("enquiries", "manage"),
        ("enquiries", "approve"),
        ("chat", "manage"),
        ("analytics", "read"),
        ("sales", "read"),
        ("sales", "manage"),
        ("audit", "read"),
        ("hr", "manage"),
        ("platform", "admin"),
    ],
}


@pytest_asyncio.fixture
async def staff_tokens(db_session, client) -> dict[str, str]:
    """Provision RBAC rows + one active user per staff role; log each in via
    the real API so tokens carry genuine permission claims."""
    from app.models.rbac import Permission, Role, RolePermission
    from app.models.user import User, UserProfile, UserRole, UserStatus
    from app.security import hash_password

    from sqlalchemy import select

    # Migrations seed some permissions (e.g. enquiries/approve from 0015), so the
    # table isn't empty like it was under create_all. Reuse whatever exists and
    # only insert the gaps — otherwise we trip uq_permissions_resource_action.
    perm_rows: dict[tuple[str, str], Permission] = {
        (p.resource, p.action): p
        for p in (await db_session.execute(select(Permission))).scalars()
    }
    for pairs in _STAFF_PERMS.values():
        for resource, action in pairs:
            if (resource, action) not in perm_rows:
                perm = Permission(resource=resource, action=action)
                db_session.add(perm)
                perm_rows[(resource, action)] = perm
    await db_session.flush()

    for role_name, pairs in _STAFF_PERMS.items():
        role = Role(name=role_name, description=f"test {role_name}")
        db_session.add(role)
        await db_session.flush()
        for pair in pairs:
            db_session.add(RolePermission(role_id=role.id, permission_id=perm_rows[pair].id))
        user = User(
            phone=STAFF_PHONES[role_name],
            password_hash=hash_password(STAFF_PASSWORD),
            role=UserRole(role_name),
            status=UserStatus.active,
        )
        user.profile = UserProfile(full_name=f"Test {role_name.title()}")
        db_session.add(user)
    await db_session.flush()

    tokens: dict[str, str] = {}
    for role_name, phone in STAFF_PHONES.items():
        r = await client.post("/api/v1/auth/login", json={"phone": phone, "password": STAFF_PASSWORD})
        assert r.status_code == 200, r.text
        tokens[role_name] = r.json()["access_token"]
    return tokens


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def seeded_catalogue(db_session) -> dict[str, Any]:
    """Insert a single category + product + variant + retail price for tests."""
    from datetime import datetime

    from app.models.catalogue import (
        Category,
        PriceRole,
        Product,
        ProductPrice,
        ProductVariant,
        ScheduleClass,
        StockStatus,
    )

    cat = Category(slug="prescription", name="Prescription Rx", sku_prefix="RX", sort_order=0)
    db_session.add(cat)
    await db_session.flush()

    product = Product(
        slug="amoxicillin-500mg-capsules",
        name="Amoxicillin 500mg Capsules",
        description="Broad-spectrum penicillin antibiotic.",
        category_id=cat.id,
        sub_category="Antibiotics",
        schedule=ScheduleClass.H,
        stock_status=StockStatus.in_stock,
        is_featured=True,
        rating=4.6,
        reviews_count=1284,
    )
    db_session.add(product)
    await db_session.flush()

    variant = ProductVariant(
        product_id=product.id,
        pack_size="10 x 10 strip",
        unit_label="10 x 10 strip",
        is_default=True,
    )
    db_session.add(variant)
    await db_session.flush()

    now = datetime.now(UTC)
    for role, sell in ((PriceRole.customer, 100), (PriceRole.clinician, 90), (PriceRole.retailer, 85)):
        db_session.add(
            ProductPrice(
                variant_id=variant.id,
                role=role,
                mrp=100,
                selling_price=sell,
                currency="INR",
                valid_from=now,
            )
        )
    await db_session.flush()
    return {"category": cat, "product": product, "variant": variant}


@pytest_asyncio.fixture
async def multi_catalogue(db_session) -> dict[str, Any]:
    """Insert multiple brands / sub_categories / prices for filter+sort tests."""
    from datetime import datetime

    from app.models.catalogue import (
        Category,
        PriceRole,
        Product,
        ProductPrice,
        ProductVariant,
        ScheduleClass,
        StockStatus,
    )

    cat = Category(slug="prescription", name="Prescription Rx", sku_prefix="RX", sort_order=0)
    db_session.add(cat)
    await db_session.flush()

    seeds = [
        # slug, name, sub_category, rating, reviews_count, customer_price
        ("amoxicillin-500mg", "Amoxicillin 500mg", "Antibiotics", 4.6, 1284, 100),
        ("paracetamol-650mg", "Paracetamol 650mg", "Analgesics", 4.2, 980, 30),
        ("ibuprofen-400mg", "Ibuprofen 400mg", "Analgesics", 4.5, 450, 50),
        ("azithromycin-500mg", "Azithromycin 500mg", "Antibiotics", 4.7, 2100, 220),
        ("metformin-500mg", "Metformin 500mg", "Diabetes", 4.0, 120, 80),
    ]
    products: list[Product] = []
    now = datetime.now(UTC)
    for slug, name, sub, rating, reviews, price in seeds:
        p = Product(
            slug=slug,
            name=name,
            description=f"{name} oral tablet.",
            category_id=cat.id,
            sub_category=sub,
            schedule=ScheduleClass.H,
            stock_status=StockStatus.in_stock,
            is_featured=False,
            rating=rating,
            reviews_count=reviews,
        )
        db_session.add(p)
        await db_session.flush()
        v = ProductVariant(
            product_id=p.id,
            pack_size="10x10",
            unit_label="10 x 10 strip",
            is_default=True,
        )
        db_session.add(v)
        await db_session.flush()
        db_session.add(
            ProductPrice(
                variant_id=v.id,
                role=PriceRole.customer,
                mrp=price,
                selling_price=price,
                currency="INR",
                valid_from=now,
            )
        )
        products.append(p)
    await db_session.flush()
    return {"category": cat, "products": products}
