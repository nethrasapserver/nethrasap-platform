"""Test fixtures.

Strategy:
- Spin up the schema once per test session against TEST_DATABASE_URL.
- Each test runs inside a SAVEPOINT so all writes roll back at teardown.
- The FastAPI dependency `get_session` is overridden to use the test session.
"""
from __future__ import annotations

# Ensure config sees the test DB before anything else imports app.config.
import os
from collections.abc import AsyncIterator
from typing import Any

import pytest_asyncio
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

from datetime import UTC  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import _normalise_url, get_session  # noqa: E402
from app.integrations.sms import ConsoleSmsProvider, get_provider  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402

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


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def _schema():
    """Create the schema + triggers once per session.

    The engine used here is created and fully disposed inside this fixture so
    no connection ever crosses into another test's event loop — each test gets
    its own engine in `db_session` (NullPool, cheap over TLS to Neon).
    """
    url, connect_args = _engine_kwargs()
    engine = create_async_engine(url, echo=False, connect_args=connect_args)
    async with engine.begin() as conn:
        # Make sure pgcrypto exists (test DB may be created without docker init)
        await conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        # Re-create the products tsvector trigger because run_sync above creates
        # tables/indexes but not our raw trigger.
        await conn.exec_driver_sql(
            """
            CREATE OR REPLACE FUNCTION products_tsv_trigger()
            RETURNS trigger AS $$
            BEGIN
              NEW.search_tsv :=
                setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(NEW.brand, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
              RETURN NEW;
            END
            $$ LANGUAGE plpgsql;
            """
        )
        await conn.exec_driver_sql("DROP TRIGGER IF EXISTS products_tsv_update ON products")
        await conn.exec_driver_sql(
            """
            CREATE TRIGGER products_tsv_update
              BEFORE INSERT OR UPDATE OF name, brand, description ON products
              FOR EACH ROW EXECUTE FUNCTION products_tsv_trigger();
            """
        )
        # Reviews denorm trigger (matches migration 0002)
        await conn.exec_driver_sql(
            """
            CREATE OR REPLACE FUNCTION reviews_recompute_product()
            RETURNS trigger AS $$
            DECLARE
              target_product_id uuid := COALESCE(NEW.product_id, OLD.product_id);
            BEGIN
              UPDATE products p
                 SET rating = COALESCE(
                       (SELECT ROUND(AVG(r.rating)::numeric, 2)
                        FROM reviews r WHERE r.product_id = target_product_id),
                       0),
                     reviews_count = (
                       SELECT COUNT(*) FROM reviews r WHERE r.product_id = target_product_id),
                     updated_at = NOW()
               WHERE p.id = target_product_id;
              RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;
            """
        )
        await conn.exec_driver_sql(
            "DROP TRIGGER IF EXISTS reviews_recompute_aiud ON reviews"
        )
        await conn.exec_driver_sql(
            """
            CREATE TRIGGER reviews_recompute_aiud
              AFTER INSERT OR UPDATE OR DELETE ON reviews
              FOR EACH ROW EXECUTE FUNCTION reviews_recompute_product();
            """
        )
        # Functional index for case-insensitive sub_category
        await conn.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_products_sub_category_lower "
            "ON products (LOWER(sub_category))"
        )
        # Order-number sequence (raw DDL in migration 0003, invisible to create_all)
        await conn.exec_driver_sql("CREATE SEQUENCE IF NOT EXISTS order_number_seq")
        # Default warehouse (migration 0007 seeds it; create_all doesn't).
        # id needs gen_random_uuid() here — the model's uuid_pk default is
        # Python-side and doesn't apply to a raw INSERT.
        await conn.exec_driver_sql(
            "INSERT INTO warehouses (id, code, name, city, state) "
            "VALUES (gen_random_uuid(), 'MAIN', 'Main Warehouse', 'Chennai', 'Tamil Nadu') "
            "ON CONFLICT (code) DO NOTHING"
        )
    await engine.dispose()
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
    "sales": [("kyc", "review"), ("kyc", "approve"), ("kyc", "reject"), ("orders", "fulfil")],
    "manager": [("kyc", "review"), ("kyc", "approve"), ("kyc", "reject"), ("orders", "fulfil")],
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
    ],
}


@pytest_asyncio.fixture
async def staff_tokens(db_session, client) -> dict[str, str]:
    """Provision RBAC rows + one active user per staff role; log each in via
    the real API so tokens carry genuine permission claims."""
    from app.models.rbac import Permission, Role, RolePermission
    from app.models.user import User, UserProfile, UserRole, UserStatus
    from app.security import hash_password

    perm_rows: dict[tuple[str, str], Permission] = {}
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
        brand="Cipla",
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
        # slug, name, brand, sub_category, rating, reviews_count, customer_price
        ("amoxicillin-500mg", "Amoxicillin 500mg", "Cipla", "Antibiotics", 4.6, 1284, 100),
        ("paracetamol-650mg", "Paracetamol 650mg", "Sun Pharma", "Analgesics", 4.2, 980, 30),
        ("ibuprofen-400mg", "Ibuprofen 400mg", "Cipla", "Analgesics", 4.5, 450, 50),
        ("azithromycin-500mg", "Azithromycin 500mg", "Cipla", "Antibiotics", 4.7, 2100, 220),
        ("metformin-500mg", "Metformin 500mg", "Sun Pharma", "Diabetes", 4.0, 120, 80),
    ]
    products: list[Product] = []
    now = datetime.now(UTC)
    for slug, name, brand, sub, rating, reviews, price in seeds:
        p = Product(
            slug=slug,
            name=name,
            brand=brand,
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
