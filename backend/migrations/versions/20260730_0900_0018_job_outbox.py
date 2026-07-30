"""Transactional outbox for background jobs.

`job_outbox` rows are written in the same transaction as the business change
that wants a job enqueued; a post-commit dispatcher (plus a worker cron sweep)
pushes them onto arq. Rows failing 10+ dispatch attempts park as `failed`
(dead-letter) for manual inspection.

Revision ID: 0018_job_outbox
Revises: 0017_drop_brand
Create Date: 2026-07-30
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018_job_outbox"
down_revision: str | Sequence[str] | None = "0017_drop_brand"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OUTBOX_STATUS = ("pending", "dispatched", "failed")


def upgrade() -> None:
    postgresql.ENUM(*OUTBOX_STATUS, name="job_outbox_status").create(op.get_bind(), checkfirst=True)

    op.create_table(
        "job_outbox",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("task_name", sa.String(120), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("status", postgresql.ENUM(*OUTBOX_STATUS, name="job_outbox_status", create_type=False),
                  nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_job_outbox_status_created_at", "job_outbox", ["status", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_job_outbox_status_created_at", table_name="job_outbox")
    op.drop_table("job_outbox")
    op.execute("DROP TYPE IF EXISTS job_outbox_status")
