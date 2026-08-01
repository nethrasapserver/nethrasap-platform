"""CMS endpoints — public reads for the storefront, admin writes for the dashboard."""
from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from ...db import DbSession
from ...deps import require_permission
from ...models.user import User
from ...schemas.cms import (
    BlockCreate,
    BlockUpdate,
    CmsPageOut,
    CmsUploadRequest,
    FlagOut,
    FlagPut,
    PageCreate,
    PageUpdate,
    SettingsPut,
)
from ...services import cms as svc

router = APIRouter()

CmsAdmin = Annotated[User, Depends(require_permission("cms:write"))]
SettingsAdmin = Annotated[User, Depends(require_permission("settings:write"))]


# --- Public ------------------------------------------------------------------


@router.get("/cms/pages/{slug}", response_model=CmsPageOut)
async def get_page(slug: str, db: DbSession) -> CmsPageOut:
    return CmsPageOut(**await svc.get_page_public(db, slug))


@router.get("/flags")
async def flags(db: DbSession) -> dict[str, bool]:
    return await svc.public_flags(db)


# --- Admin: pages & blocks -----------------------------------------------------


@router.get("/admin/cms/pages", response_model=list[CmsPageOut])
async def list_pages(db: DbSession, _a: CmsAdmin) -> list[CmsPageOut]:
    return [CmsPageOut(**svc.serialise_page(p)) for p in await svc.list_pages(db)]


@router.post("/admin/cms/pages", response_model=CmsPageOut, status_code=status.HTTP_201_CREATED)
async def create_page(payload: PageCreate, db: DbSession, actor: CmsAdmin) -> CmsPageOut:
    page = await svc.create_page(
        db, actor, slug=payload.slug, title=payload.title, is_published=payload.is_published
    )
    return CmsPageOut(**svc.serialise_page(page))


@router.patch("/admin/cms/pages/{page_id}", response_model=CmsPageOut)
async def update_page(page_id: UUID, payload: PageUpdate, db: DbSession, actor: CmsAdmin) -> CmsPageOut:
    page = await svc.update_page(db, actor, page_id, payload.model_dump(exclude_unset=True))
    return CmsPageOut(**svc.serialise_page(page))


@router.delete("/admin/cms/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_page(page_id: UUID, db: DbSession, actor: CmsAdmin) -> Response:
    await svc.delete_page(db, actor, page_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/admin/cms/pages/{page_id}/blocks", response_model=CmsPageOut, status_code=status.HTTP_201_CREATED
)
async def add_block(page_id: UUID, payload: BlockCreate, db: DbSession, actor: CmsAdmin) -> CmsPageOut:
    page = await svc.add_block(db, actor, page_id, payload.model_dump())
    return CmsPageOut(**svc.serialise_page(page))


@router.patch("/admin/cms/blocks/{block_id}", response_model=CmsPageOut)
async def update_block(block_id: UUID, payload: BlockUpdate, db: DbSession, actor: CmsAdmin) -> CmsPageOut:
    page = await svc.update_block(db, actor, block_id, payload.model_dump(exclude_unset=True))
    return CmsPageOut(**svc.serialise_page(page))


@router.delete("/admin/cms/blocks/{block_id}", response_model=CmsPageOut)
async def delete_block(block_id: UUID, db: DbSession, actor: CmsAdmin) -> CmsPageOut:
    page = await svc.delete_block(db, actor, block_id)
    return CmsPageOut(**svc.serialise_page(page))


# --- Admin: image uploads ----------------------------------------------------


@router.post("/admin/cms/uploads")
async def create_upload(payload: CmsUploadRequest, _a: CmsAdmin) -> dict[str, str]:
    """Presign a direct image upload for CMS content (cms:write gated)."""
    return svc.create_upload_slot(content_type=payload.content_type)


# --- Admin: settings & flags ------------------------------------------------------


@router.get("/admin/settings")
async def get_settings(db: DbSession, _a: SettingsAdmin) -> dict[str, Any]:
    return await svc.get_settings_map(db)


@router.put("/admin/settings")
async def put_settings(payload: SettingsPut, db: DbSession, actor: SettingsAdmin) -> dict[str, Any]:
    return await svc.put_settings(db, actor, payload.values)


@router.get("/admin/flags", response_model=list[FlagOut])
async def list_flags(db: DbSession, _a: SettingsAdmin) -> list[FlagOut]:
    return [FlagOut.model_validate(f) for f in await svc.list_flags(db)]


@router.put("/admin/flags", response_model=FlagOut)
async def put_flag(payload: FlagPut, db: DbSession, actor: SettingsAdmin) -> FlagOut:
    flag = await svc.put_flag(
        db, actor, key=payload.key, enabled=payload.enabled, description=payload.description
    )
    return FlagOut.model_validate(flag)
