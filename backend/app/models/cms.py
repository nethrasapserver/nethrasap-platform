"""CMS content, app settings, feature flags — everything that was hardcoded
prose/arrays in the demo frontends becomes admin-editable rows here."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, created_at, updated_at, uuid_pk


class CmsPage(Base):
    """A logical page/surface: home, privacy, terms, refund, faq, about…"""

    __tablename__ = "cms_pages"

    id: Mapped[uuid_pk]
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="true")

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    blocks: Mapped[list[CmsBlock]] = relationship(
        back_populates="page",
        cascade="all, delete-orphan",
        order_by="CmsBlock.sort_order",
        lazy="selectin",
    )


class CmsBlock(Base):
    """One block on a page. `kind` tells the frontend which component renders
    it (hero_slide, promo, faq_item, policy_section, stat, trust_badge, …);
    `content` is the kind-specific JSON payload."""

    __tablename__ = "cms_blocks"

    id: Mapped[uuid_pk]
    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cms_pages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default="true")
    content: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]

    page: Mapped[CmsPage] = relationship(back_populates="blocks")


class AppSetting(Base):
    """Typed key/value platform settings (shipping thresholds, support phone,
    business hours…). Values are JSON so numbers/strings/objects all fit."""

    __tablename__ = "app_settings"

    id: Mapped[uuid_pk]
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id: Mapped[uuid_pk]
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    description: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[created_at]
    updated_at: Mapped[updated_at]
