"""Cart, orders, payments, refunds, invoices, shipments + order-number sequence.

Revision ID: 0003_cart_orders_payments
Revises: 0002_reviews_and_filters
Create Date: 2026-05-27
"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_cart_orders_payments"
down_revision: str | Sequence[str] | None = "0002_reviews_and_filters"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


COUPON_TYPE = ("percent", "flat")
ORDER_STATUS = (
    "placed", "confirmed", "packed", "dispatched",
    "out_for_delivery", "delivered", "cancelled", "refunded", "payment_failed",
)
PAYMENT_METHOD = ("cod", "upi", "card", "netbanking", "wallet")
PAYMENT_STATUS = (
    "pending", "cod_pending", "authorized", "captured",
    "failed", "refunded", "partial_refund",
)
REFUND_STATUS = ("pending", "processing", "completed", "failed")
SHIPMENT_STATUS = (
    "pending", "in_transit", "out_for_delivery", "delivered", "returned",
)


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Products: add gst_rate_pct (snapshotted per order line)
    # ------------------------------------------------------------------
    op.add_column(
        "products",
        sa.Column(
            "gst_rate_pct",
            sa.SmallInteger,
            nullable=False,
            server_default=sa.text("12"),
        ),
    )

    # ------------------------------------------------------------------
    # 2. Enums
    # ------------------------------------------------------------------
    coupon_type = postgresql.ENUM(*COUPON_TYPE, name="coupon_type")
    order_status = postgresql.ENUM(*ORDER_STATUS, name="order_status")
    payment_method = postgresql.ENUM(*PAYMENT_METHOD, name="payment_method")
    payment_status = postgresql.ENUM(*PAYMENT_STATUS, name="payment_status")
    refund_status = postgresql.ENUM(*REFUND_STATUS, name="refund_status")
    shipment_status = postgresql.ENUM(*SHIPMENT_STATUS, name="shipment_status")
    for e in (coupon_type, order_status, payment_method, payment_status,
              refund_status, shipment_status):
        e.create(op.get_bind(), checkfirst=True)

    # ------------------------------------------------------------------
    # 3. Coupons
    # ------------------------------------------------------------------
    op.create_table(
        "coupons",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(40), nullable=False, unique=True),
        sa.Column(
            "type",
            postgresql.ENUM(*COUPON_TYPE, name="coupon_type", create_type=False),
            nullable=False,
        ),
        sa.Column("value", sa.Integer, nullable=False),
        sa.Column("min_order", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("max_uses", sa.Integer),
        sa.Column("used_count", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_coupons_code", "coupons", ["code"], unique=True)

    # ------------------------------------------------------------------
    # 4. Carts + items
    # ------------------------------------------------------------------
    op.create_table(
        "carts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_carts_user_id_users"),
        ),
        sa.Column("session_id", sa.String(64)),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column(
            "coupon_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("coupons.id", ondelete="SET NULL", name="fk_carts_coupon_id_coupons"),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.CheckConstraint(
            "user_id IS NOT NULL OR session_id IS NOT NULL",
            name="ck_carts_user_or_session",
        ),
    )
    op.create_index("ix_carts_user_id", "carts", ["user_id"])
    op.create_index("ix_carts_session_id", "carts", ["session_id"], unique=True)

    op.create_table(
        "cart_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "cart_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("carts.id", ondelete="CASCADE", name="fk_cart_items_cart_id_carts"),
            nullable=False,
        ),
        sa.Column(
            "variant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "product_variants.id",
                ondelete="CASCADE",
                name="fk_cart_items_variant_id_product_variants",
            ),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit_price_snapshot", sa.Integer, nullable=False),
        sa.Column("gst_rate_pct_snapshot", sa.SmallInteger, nullable=False),
        sa.Column("currency_snapshot", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.CheckConstraint("quantity >= 1", name="ck_cart_items_quantity_min"),
        sa.UniqueConstraint("cart_id", "variant_id", name="uq_cart_items_cart_id_variant_id"),
    )
    op.create_index("ix_cart_items_cart_id", "cart_items", ["cart_id"])
    op.create_index("ix_cart_items_variant_id", "cart_items", ["variant_id"])

    # ------------------------------------------------------------------
    # 5. Order-number sequence (NS-YYYY-NNNNN)
    # ------------------------------------------------------------------
    op.execute("CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1 INCREMENT 1")

    # ------------------------------------------------------------------
    # 6. Orders + items + status history
    # ------------------------------------------------------------------
    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_number", sa.String(20), nullable=False, unique=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT", name="fk_orders_user_id_users"),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(*ORDER_STATUS, name="order_status", create_type=False),
            nullable=False,
            server_default="placed",
        ),
        sa.Column("subtotal", sa.Integer, nullable=False),
        sa.Column("discount_total", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("gst_total", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("shipping_total", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("grand_total", sa.Integer, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("shipping_address", postgresql.JSONB, nullable=False),
        sa.Column(
            "payment_method",
            postgresql.ENUM(*PAYMENT_METHOD, name="payment_method", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "payment_status",
            postgresql.ENUM(*PAYMENT_STATUS, name="payment_status", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("coupon_code", sa.String(40)),
        sa.Column("notes", sa.Text),
        sa.Column("client_request_id", sa.String(64), unique=True),
        sa.Column("placed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
        sa.Column("delivered_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.CheckConstraint("grand_total >= 0", name="ck_orders_grand_total_non_negative"),
        sa.CheckConstraint("subtotal >= 0", name="ck_orders_subtotal_non_negative"),
    )
    op.create_index("ix_orders_user_id", "orders", ["user_id"])
    op.create_index("ix_orders_order_number", "orders", ["order_number"], unique=True)
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_placed_at", "orders", ["placed_at"])

    op.create_table(
        "order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE", name="fk_order_items_order_id_orders"),
            nullable=False,
        ),
        sa.Column(
            "variant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "product_variants.id",
                ondelete="RESTRICT",
                name="fk_order_items_variant_id_product_variants",
            ),
            nullable=False,
        ),
        sa.Column("product_name_snapshot", sa.String(255), nullable=False),
        sa.Column("brand_snapshot", sa.String(120), nullable=False),
        sa.Column("unit_label_snapshot", sa.String(120), nullable=False),
        sa.Column("hsn_code_snapshot", sa.String(12)),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit_price", sa.Integer, nullable=False),
        sa.Column("gst_rate_pct", sa.SmallInteger, nullable=False),
        sa.Column("gst_amount", sa.Integer, nullable=False),
        sa.Column("line_total", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.CheckConstraint("quantity >= 1", name="ck_order_items_quantity_min"),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])

    op.create_table(
        "order_status_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "orders.id",
                ondelete="CASCADE",
                name="fk_order_status_history_order_id_orders",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(*ORDER_STATUS, name="order_status", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "users.id",
                ondelete="SET NULL",
                name="fk_order_status_history_actor_user_id_users",
            ),
        ),
        sa.Column("note", sa.Text),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_order_status_history_order_id", "order_status_history", ["order_id"])

    # ------------------------------------------------------------------
    # 7. Payments + refunds
    # ------------------------------------------------------------------
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE", name="fk_payments_order_id_orders"),
            nullable=False,
        ),
        sa.Column(
            "method",
            postgresql.ENUM(*PAYMENT_METHOD, name="payment_method", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(*PAYMENT_STATUS, name="payment_status", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("gateway", sa.String(40)),
        sa.Column("gateway_order_id", sa.String(80)),
        sa.Column("gateway_payment_id", sa.String(80), unique=True),
        sa.Column("gateway_signature", sa.String(160)),
        sa.Column("raw_response", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("captured_at", sa.DateTime(timezone=True)),
        sa.Column("failed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_payments_order_id", "payments", ["order_id"])
    op.create_index("ix_payments_gateway_order_id", "payments", ["gateway_order_id"])
    op.create_index("ix_payments_gateway_payment_id", "payments", ["gateway_payment_id"], unique=True)

    op.create_table(
        "refunds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "payment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "payments.id",
                ondelete="CASCADE",
                name="fk_refunds_payment_id_payments",
            ),
            nullable=False,
        ),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("reason", sa.Text),
        sa.Column(
            "status",
            postgresql.ENUM(*REFUND_STATUS, name="refund_status", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("gateway_refund_id", sa.String(80), unique=True),
        sa.Column("raw_response", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_refunds_payment_id", "refunds", ["payment_id"])

    # ------------------------------------------------------------------
    # 8. Invoices + shipments
    # ------------------------------------------------------------------
    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE", name="fk_invoices_order_id_orders"),
            nullable=False,
            unique=True,
        ),
        sa.Column("invoice_number", sa.String(40), nullable=False, unique=True),
        sa.Column("pdf_storage_key", sa.String(255)),
        sa.Column("issued_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    op.create_table(
        "shipments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE", name="fk_shipments_order_id_orders"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(*SHIPMENT_STATUS, name="shipment_status", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("courier", sa.String(80)),
        sa.Column("awb_number", sa.String(64)),
        sa.Column("tracking_url", sa.String(512)),
        sa.Column("dispatched_at", sa.DateTime(timezone=True)),
        sa.Column("delivered_at", sa.DateTime(timezone=True)),
        sa.Column("eta", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_shipments_awb_number", "shipments", ["awb_number"])


def downgrade() -> None:
    op.drop_index("ix_shipments_awb_number", table_name="shipments")
    op.drop_table("shipments")

    op.drop_table("invoices")

    op.drop_index("ix_refunds_payment_id", table_name="refunds")
    op.drop_table("refunds")

    op.drop_index("ix_payments_gateway_payment_id", table_name="payments")
    op.drop_index("ix_payments_gateway_order_id", table_name="payments")
    op.drop_index("ix_payments_order_id", table_name="payments")
    op.drop_table("payments")

    op.drop_index("ix_order_status_history_order_id", table_name="order_status_history")
    op.drop_table("order_status_history")

    op.drop_index("ix_order_items_order_id", table_name="order_items")
    op.drop_table("order_items")

    op.drop_index("ix_orders_placed_at", table_name="orders")
    op.drop_index("ix_orders_status", table_name="orders")
    op.drop_index("ix_orders_order_number", table_name="orders")
    op.drop_index("ix_orders_user_id", table_name="orders")
    op.drop_table("orders")

    op.execute("DROP SEQUENCE IF EXISTS order_number_seq")

    op.drop_index("ix_cart_items_variant_id", table_name="cart_items")
    op.drop_index("ix_cart_items_cart_id", table_name="cart_items")
    op.drop_table("cart_items")

    op.drop_index("ix_carts_session_id", table_name="carts")
    op.drop_index("ix_carts_user_id", table_name="carts")
    op.drop_table("carts")

    op.drop_index("ix_coupons_code", table_name="coupons")
    op.drop_table("coupons")

    for enum_name in (
        "shipment_status", "refund_status", "payment_status",
        "payment_method", "order_status", "coupon_type",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")

    op.drop_column("products", "gst_rate_pct")
