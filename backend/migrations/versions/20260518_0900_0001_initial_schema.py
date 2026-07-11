"""Initial schema — users, RBAC, sessions, audit, categories, products.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-18
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Enum value lists — must match the str-Enum definitions in app/models/*.py
USER_ROLE = ("customer", "clinician", "retailer", "sales", "manager", "admin")
USER_STATUS = ("pending_kyc", "active", "suspended")
SCHEDULE_CLASS = ("NONE", "H", "H1", "X")
STOCK_STATUS = ("in_stock", "low_stock", "out_of_stock", "discontinued")
PRICE_ROLE = ("customer", "clinician", "retailer")


def upgrade() -> None:
    # --- Extensions ---------------------------------------------------------
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # --- Enums --------------------------------------------------------------
    user_role = postgresql.ENUM(*USER_ROLE, name="user_role")
    user_status = postgresql.ENUM(*USER_STATUS, name="user_status")
    schedule_class = postgresql.ENUM(*SCHEDULE_CLASS, name="schedule_class")
    stock_status = postgresql.ENUM(*STOCK_STATUS, name="stock_status")
    price_role = postgresql.ENUM(*PRICE_ROLE, name="price_role")
    for e in (user_role, user_status, schedule_class, stock_status, price_role):
        e.create(op.get_bind(), checkfirst=True)

    # --- users -------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(32)),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", postgresql.ENUM(*USER_ROLE, name="user_role", create_type=False), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(*USER_STATUS, name="user_status", create_type=False),
            nullable=False,
            server_default="active",
        ),
        sa.Column("email_verified_at", sa.DateTime(timezone=True)),
        sa.Column("phone_verified_at", sa.DateTime(timezone=True)),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])

    # --- user_profiles -----------------------------------------------------
    op.create_table(
        "user_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_user_profiles_user_id_users"),
            nullable=False,
            unique=True,
        ),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("avatar_url", sa.String(512)),
        sa.Column("attributes", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # --- addresses --------------------------------------------------------
    op.create_table(
        "addresses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_addresses_user_id_users"),
            nullable=False,
        ),
        sa.Column("label", sa.String(50)),
        sa.Column("line1", sa.String(255), nullable=False),
        sa.Column("line2", sa.String(255)),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("state", sa.String(100), nullable=False),
        sa.Column("pincode", sa.String(10), nullable=False),
        sa.Column("is_default_shipping", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("is_default_billing", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_addresses_user_id", "addresses", ["user_id"])
    op.create_index("ix_addresses_pincode", "addresses", ["pincode"])

    # --- sessions (refresh tokens) -----------------------------------------
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_sessions_user_id_users"),
            nullable=False,
        ),
        sa.Column("refresh_token_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("user_agent", sa.String(255)),
        sa.Column("ip", sa.String(64)),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column(
            "rotated_from",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="SET NULL", name="fk_sessions_rotated_from_sessions"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    # --- roles + permissions + role_permissions ----------------------------
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("description", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("resource", sa.String(50), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("description", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("resource", "action", name="uq_permissions_resource_action"),
    )
    op.create_index("ix_permissions_resource", "permissions", ["resource"])

    op.create_table(
        "role_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "role_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("roles.id", ondelete="CASCADE", name="fk_role_permissions_role_id_roles"),
            nullable=False,
        ),
        sa.Column(
            "permission_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("permissions.id", ondelete="CASCADE", name="fk_role_permissions_permission_id_permissions"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permissions_role_id_permission_id"),
    )
    op.create_index("ix_role_permissions_role_id", "role_permissions", ["role_id"])
    op.create_index("ix_role_permissions_permission_id", "role_permissions", ["permission_id"])

    # --- audit_log ---------------------------------------------------------
    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_audit_log_actor_user_id_users"),
        ),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("entity_type", sa.String(80)),
        sa.Column("entity_id", sa.String(80)),
        sa.Column("payload", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("ip", sa.String(64)),
        sa.Column("user_agent", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_audit_log_actor_user_id", "audit_log", ["actor_user_id"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_entity_type", "audit_log", ["entity_type"])

    # --- categories --------------------------------------------------------
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("sku_prefix", sa.String(8), nullable=False),
        sa.Column("glyph", sa.String(50)),
        sa.Column("image_key", sa.String(255)),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column(
            "parent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="SET NULL", name="fk_categories_parent_id_categories"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_categories_slug", "categories", ["slug"], unique=True)
    op.create_index("ix_categories_parent_id", "categories", ["parent_id"])

    # --- products ----------------------------------------------------------
    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(150), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("brand", sa.String(120), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="RESTRICT", name="fk_products_category_id_categories"),
            nullable=False,
        ),
        sa.Column("sub_category", sa.String(80)),
        sa.Column(
            "schedule",
            postgresql.ENUM(*SCHEDULE_CLASS, name="schedule_class", create_type=False),
            nullable=False,
            server_default="NONE",
        ),
        sa.Column("hsn_code", sa.String(12)),
        sa.Column(
            "stock_status",
            postgresql.ENUM(*STOCK_STATUS, name="stock_status", create_type=False),
            nullable=False,
            server_default="in_stock",
        ),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("is_featured", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("badge", sa.String(50)),
        sa.Column("dispatch_sla_hours", sa.Integer),
        sa.Column("delivery_time_mins", sa.Integer),
        sa.Column("rating", sa.Numeric(3, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("reviews_count", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("specs", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("attributes", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("search_tsv", postgresql.TSVECTOR),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_products_slug", "products", ["slug"], unique=True)
    op.create_index("ix_products_brand", "products", ["brand"])
    op.create_index("ix_products_category_id", "products", ["category_id"])
    op.create_index("ix_products_stock_status", "products", ["stock_status"])
    op.create_index("ix_products_is_featured", "products", ["is_featured"])
    op.create_index(
        "ix_products_search_tsv",
        "products",
        ["search_tsv"],
        postgresql_using="gin",
    )

    # Trigger maintains products.search_tsv on every insert/update.
    op.execute(
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
    op.execute(
        """
        CREATE TRIGGER products_tsv_update
          BEFORE INSERT OR UPDATE OF name, brand, description ON products
          FOR EACH ROW EXECUTE FUNCTION products_tsv_trigger();
        """
    )

    # --- product_variants --------------------------------------------------
    op.create_table(
        "product_variants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE", name="fk_product_variants_product_id_products"),
            nullable=False,
        ),
        sa.Column("pack_size", sa.String(80), nullable=False),
        sa.Column("unit_label", sa.String(120), nullable=False),
        sa.Column("barcode", sa.String(64), unique=True),
        sa.Column("weight_g", sa.Integer),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_product_variants_product_id", "product_variants", ["product_id"])

    # --- product_prices ----------------------------------------------------
    op.create_table(
        "product_prices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "variant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("product_variants.id", ondelete="CASCADE", name="fk_product_prices_variant_id_product_variants"),
            nullable=False,
        ),
        sa.Column(
            "role",
            postgresql.ENUM(*PRICE_ROLE, name="price_role", create_type=False),
            nullable=False,
        ),
        sa.Column("mrp", sa.Integer, nullable=False),
        sa.Column("selling_price", sa.Integer, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_to", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_product_prices_variant_id", "product_prices", ["variant_id"])
    op.create_index("ix_product_prices_role", "product_prices", ["role"])
    # Only one active price per (variant, role) at a time.
    op.execute(
        """
        CREATE UNIQUE INDEX uq_product_prices_active
          ON product_prices (variant_id, role)
          WHERE valid_to IS NULL;
        """
    )

    # --- product_images ----------------------------------------------------
    op.create_table(
        "product_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE", name="fk_product_images_product_id_products"),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(255), nullable=False),
        sa.Column("alt", sa.String(255)),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("product_id", "storage_key", name="uq_product_images_product_id_storage_key"),
    )
    op.create_index("ix_product_images_product_id", "product_images", ["product_id"])


def downgrade() -> None:
    op.drop_index("ix_product_images_product_id", table_name="product_images")
    op.drop_table("product_images")

    op.execute("DROP INDEX IF EXISTS uq_product_prices_active")
    op.drop_index("ix_product_prices_role", table_name="product_prices")
    op.drop_index("ix_product_prices_variant_id", table_name="product_prices")
    op.drop_table("product_prices")

    op.drop_index("ix_product_variants_product_id", table_name="product_variants")
    op.drop_table("product_variants")

    op.execute("DROP TRIGGER IF EXISTS products_tsv_update ON products")
    op.execute("DROP FUNCTION IF EXISTS products_tsv_trigger()")
    op.drop_index("ix_products_search_tsv", table_name="products")
    op.drop_index("ix_products_is_featured", table_name="products")
    op.drop_index("ix_products_stock_status", table_name="products")
    op.drop_index("ix_products_category_id", table_name="products")
    op.drop_index("ix_products_brand", table_name="products")
    op.drop_index("ix_products_slug", table_name="products")
    op.drop_table("products")

    op.drop_index("ix_categories_parent_id", table_name="categories")
    op.drop_index("ix_categories_slug", table_name="categories")
    op.drop_table("categories")

    op.drop_index("ix_audit_log_entity_type", table_name="audit_log")
    op.drop_index("ix_audit_log_action", table_name="audit_log")
    op.drop_index("ix_audit_log_actor_user_id", table_name="audit_log")
    op.drop_table("audit_log")

    op.drop_index("ix_role_permissions_permission_id", table_name="role_permissions")
    op.drop_index("ix_role_permissions_role_id", table_name="role_permissions")
    op.drop_table("role_permissions")
    op.drop_index("ix_permissions_resource", table_name="permissions")
    op.drop_table("permissions")
    op.drop_table("roles")

    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_table("sessions")

    op.drop_index("ix_addresses_pincode", table_name="addresses")
    op.drop_index("ix_addresses_user_id", table_name="addresses")
    op.drop_table("addresses")

    op.drop_table("user_profiles")

    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    for enum_name in ("price_role", "stock_status", "schedule_class", "user_status", "user_role"):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
