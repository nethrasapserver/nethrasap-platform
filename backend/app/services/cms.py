"""CMS pages/blocks + app settings + feature flags.

Public read side feeds the storefront (home hero, promos, policies, FAQs);
admin write side is the dashboard's page editor & settings screens.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..integrations import storage
from ..logging import get_logger
from ..models.audit import AuditLog
from ..models.cms import AppSetting, CmsBlock, CmsPage, FeatureFlag
from ..models.user import User
from ..realtime import publish_event
from ..realtime.channels import topic_channel

log = get_logger("services.cms")


async def _cms_event(entity: str, entity_id: str) -> None:
    await publish_event(topic_channel("catalogue"), type="cms.updated", entity=entity, entity_id=entity_id)


def _audit(db: AsyncSession, actor: User, action: str, entity_type: str, entity_id: str, payload: dict) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
        )
    )


async def _page(db: AsyncSession, page_id: uuid.UUID) -> CmsPage:
    page = (
        await db.execute(
            select(CmsPage)
            .options(selectinload(CmsPage.blocks))
            .where(CmsPage.id == page_id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if page is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "page not found")
    return page


# --- Public read ---------------------------------------------------------------


async def get_page_public(db: AsyncSession, slug: str) -> dict[str, Any]:
    page = (
        await db.execute(
            select(CmsPage)
            .options(selectinload(CmsPage.blocks))
            .where(CmsPage.slug == slug, CmsPage.is_published.is_(True))
        )
    ).scalar_one_or_none()
    if page is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "page not found")
    return serialise_page(page, active_only=True)


async def public_flags(db: AsyncSession) -> dict[str, bool]:
    rows = (await db.execute(select(FeatureFlag))).scalars()
    return {f.key: f.enabled for f in rows}


# --- Admin: image uploads --------------------------------------------------------


def create_upload_slot(*, content_type: str) -> dict[str, str]:
    """Presigned direct upload for a CMS image (hero art, block media).

    Mirrors the catalogue presign flow: mint a key under the `cms` namespace,
    hand back the PUT URL the dashboard uploads to plus the public URL to store
    in the block content. Presigning is local HMAC math, so no DB/session needed.
    """
    if content_type not in storage.ALLOWED_IMAGE_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "unsupported image type")
    key = storage.make_key("cms", content_type=content_type)
    return {
        "upload_url": storage.presigned_put(key, content_type=content_type),
        "public_url": storage.public_url(key),
    }


# --- Admin: pages & blocks -------------------------------------------------------


async def list_pages(db: AsyncSession) -> list[CmsPage]:
    return list(
        (await db.execute(select(CmsPage).options(selectinload(CmsPage.blocks)).order_by(CmsPage.slug)))
        .scalars()
        .unique()
    )


async def create_page(db: AsyncSession, actor: User, *, slug: str, title: str, is_published: bool) -> CmsPage:
    if (await db.execute(select(CmsPage.id).where(CmsPage.slug == slug))).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, f"page exists: {slug}")
    page = CmsPage(slug=slug, title=title, is_published=is_published)
    db.add(page)
    await db.flush()
    _audit(db, actor, "cms_page.created", "cms_page", str(page.id), {"slug": slug})
    await db.commit()
    await _cms_event("cms_page", str(page.id))
    return await _page(db, page.id)


async def update_page(db: AsyncSession, actor: User, page_id: uuid.UUID, data: dict) -> CmsPage:
    page = await _page(db, page_id)
    for k, v in {k: v for k, v in data.items() if v is not None}.items():
        setattr(page, k, v)
    _audit(db, actor, "cms_page.updated", "cms_page", str(page.id), {"fields": sorted(data)})
    await db.commit()
    await _cms_event("cms_page", str(page.id))
    return await _page(db, page_id)


async def delete_page(db: AsyncSession, actor: User, page_id: uuid.UUID) -> None:
    page = await _page(db, page_id)
    await db.delete(page)
    _audit(db, actor, "cms_page.deleted", "cms_page", str(page_id), {"slug": page.slug})
    await db.commit()
    await _cms_event("cms_page", str(page_id))


async def add_block(db: AsyncSession, actor: User, page_id: uuid.UUID, data: dict) -> CmsPage:
    page = await _page(db, page_id)
    block = CmsBlock(page_id=page.id, **data)
    db.add(block)
    await db.flush()
    _audit(db, actor, "cms_block.created", "cms_block", str(block.id), {"page": page.slug, "kind": block.kind})
    await db.commit()
    await _cms_event("cms_page", str(page.id))
    return await _page(db, page_id)


async def update_block(db: AsyncSession, actor: User, block_id: uuid.UUID, data: dict) -> CmsPage:
    block = (await db.execute(select(CmsBlock).where(CmsBlock.id == block_id))).scalar_one_or_none()
    if block is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "block not found")
    for k, v in {k: v for k, v in data.items() if v is not None}.items():
        setattr(block, k, v)
    _audit(db, actor, "cms_block.updated", "cms_block", str(block.id), {"fields": sorted(data)})
    await db.commit()
    await _cms_event("cms_page", str(block.page_id))
    return await _page(db, block.page_id)


async def delete_block(db: AsyncSession, actor: User, block_id: uuid.UUID) -> CmsPage:
    block = (await db.execute(select(CmsBlock).where(CmsBlock.id == block_id))).scalar_one_or_none()
    if block is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "block not found")
    page_id = block.page_id
    await db.delete(block)
    _audit(db, actor, "cms_block.deleted", "cms_block", str(block_id), {})
    await db.commit()
    await _cms_event("cms_page", str(page_id))
    return await _page(db, page_id)


# --- Admin: settings & flags ---------------------------------------------------------


async def get_settings_map(db: AsyncSession) -> dict[str, Any]:
    rows = (await db.execute(select(AppSetting).order_by(AppSetting.key))).scalars()
    return {s.key: s.value for s in rows}


async def put_settings(db: AsyncSession, actor: User, values: dict[str, Any]) -> dict[str, Any]:
    existing = {
        s.key: s for s in (await db.execute(select(AppSetting).where(AppSetting.key.in_(values)))).scalars()
    }
    for key, value in values.items():
        if key in existing:
            existing[key].value = value
        else:
            db.add(AppSetting(key=key, value=value))
    _audit(db, actor, "settings.updated", "app_settings", "bulk", {"keys": sorted(values)})
    await db.commit()
    return await get_settings_map(db)


async def list_flags(db: AsyncSession) -> list[FeatureFlag]:
    return list((await db.execute(select(FeatureFlag).order_by(FeatureFlag.key))).scalars())


async def put_flag(
    db: AsyncSession, actor: User, *, key: str, enabled: bool, description: str | None
) -> FeatureFlag:
    flag = (await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))).scalar_one_or_none()
    if flag is None:
        flag = FeatureFlag(key=key, enabled=enabled, description=description)
        db.add(flag)
    else:
        flag.enabled = enabled
        if description is not None:
            flag.description = description
    _audit(db, actor, "feature_flag.updated", "feature_flag", key, {"enabled": enabled})
    await db.commit()
    await _cms_event("feature_flag", key)
    return flag


# --- Serialisation ---------------------------------------------------------------------


def serialise_page(page: CmsPage, *, active_only: bool = False) -> dict[str, Any]:
    return {
        "id": page.id,
        "slug": page.slug,
        "title": page.title,
        "is_published": page.is_published,
        "blocks": [
            {
                "id": b.id,
                "kind": b.kind,
                "sort_order": b.sort_order,
                "is_active": b.is_active,
                "content": b.content,
            }
            for b in page.blocks
            if b.is_active or not active_only
        ],
    }
