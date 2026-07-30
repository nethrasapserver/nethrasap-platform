"""Admin catalogue endpoints — behind the `catalogue:write` permission.

Storefront reads stay on the public /products & /categories routes; this
module is the write side the admin dashboard drives.
"""
from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, Field

from ...db import DbSession
from ...deps import require_permission
from ...models.user import User
from ...schemas.admin import (
    AdminProductOut,
    CategoryCreate,
    CategoryUpdate,
    CouponCreate,
    CouponOut,
    CouponUpdate,
    ImageSlotRequest,
    ImageSlotResponse,
    ImageUrlRequest,
    ImportReport,
    ProductCreate,
    ProductUpdate,
    VariantCreate,
    VariantUpdate,
)
from ...services import admin_catalogue as svc

router = APIRouter()

CatalogueAdmin = Annotated[User, Depends(require_permission("catalogue:write"))]


def _out(product) -> AdminProductOut:
    return AdminProductOut(**svc.serialise_admin_product(product))


# --- Products ----------------------------------------------------------------


@router.get("/admin/products")
async def list_products_admin(db: DbSession, actor: CatalogueAdmin) -> list[dict]:
    """Full product list including unpublished rows — the ops table view."""
    return await svc.list_products_admin(db)


@router.post("/admin/products", response_model=AdminProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(payload: ProductCreate, db: DbSession, actor: CatalogueAdmin) -> AdminProductOut:
    return _out(await svc.create_product(db, actor, payload.model_dump()))


@router.patch("/admin/products/{product_id}", response_model=AdminProductOut)
async def update_product(
    product_id: UUID, payload: ProductUpdate, db: DbSession, actor: CatalogueAdmin
) -> AdminProductOut:
    return _out(await svc.update_product(db, actor, product_id, payload.model_dump(exclude_unset=True)))


@router.post("/admin/products/{product_id}/publish", response_model=AdminProductOut)
async def publish(product_id: UUID, db: DbSession, actor: CatalogueAdmin) -> AdminProductOut:
    return _out(await svc.set_product_active(db, actor, product_id, True))


@router.post("/admin/products/{product_id}/unpublish", response_model=AdminProductOut)
async def unpublish(product_id: UUID, db: DbSession, actor: CatalogueAdmin) -> AdminProductOut:
    return _out(await svc.set_product_active(db, actor, product_id, False))


# --- Variants & prices ---------------------------------------------------------


@router.post(
    "/admin/products/{product_id}/variants",
    response_model=AdminProductOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_variant(
    product_id: UUID, payload: VariantCreate, db: DbSession, actor: CatalogueAdmin
) -> AdminProductOut:
    return _out(await svc.add_variant(db, actor, product_id, payload.model_dump()))


@router.patch("/admin/variants/{variant_id}", response_model=AdminProductOut)
async def update_variant(
    variant_id: UUID, payload: VariantUpdate, db: DbSession, actor: CatalogueAdmin
) -> AdminProductOut:
    return _out(await svc.update_variant(db, actor, variant_id, payload.model_dump(exclude_unset=True)))


# --- Images ---------------------------------------------------------------------


@router.post(
    "/admin/products/{product_id}/images",
    response_model=ImageSlotResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_image_slot(
    product_id: UUID, payload: ImageSlotRequest, db: DbSession, actor: CatalogueAdmin
) -> ImageSlotResponse:
    slot = await svc.create_image_slot(
        db,
        actor,
        product_id,
        content_type=payload.content_type,
        alt=payload.alt,
        is_primary=payload.is_primary,
    )
    return ImageSlotResponse(**slot)


@router.post("/admin/products/{product_id}/images/url", status_code=status.HTTP_201_CREATED)
async def add_image_url(
    product_id: UUID, payload: ImageUrlRequest, db: DbSession, actor: CatalogueAdmin
) -> dict:
    """Attach a product image by public URL (works without object storage)."""
    return await svc.add_image_url(
        db, actor, product_id, url=payload.url, alt=payload.alt, is_primary=payload.is_primary
    )


@router.patch("/admin/images/{image_id}/primary", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def set_primary_image(image_id: UUID, db: DbSession, actor: CatalogueAdmin) -> Response:
    await svc.set_primary_image(db, actor, image_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/admin/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_image(image_id: UUID, db: DbSession, actor: CatalogueAdmin) -> Response:
    await svc.delete_image(db, actor, image_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Categories ------------------------------------------------------------------


@router.get("/admin/categories")
async def list_categories_admin(db: DbSession, actor: CatalogueAdmin) -> list[dict]:
    """All categories including inactive, with live product counts."""
    return await svc.list_categories_admin(db)


@router.post("/admin/categories", status_code=status.HTTP_201_CREATED)
async def create_category(payload: CategoryCreate, db: DbSession, actor: CatalogueAdmin) -> dict:
    c = await svc.create_category(db, actor, payload.model_dump())
    return {"id": c.id, "slug": c.slug, "name": c.name}


@router.patch("/admin/categories/{category_id}")
async def update_category(
    category_id: UUID, payload: CategoryUpdate, db: DbSession, actor: CatalogueAdmin
) -> dict:
    c = await svc.update_category(db, actor, category_id, payload.model_dump(exclude_unset=True))
    return {"id": c.id, "slug": c.slug, "name": c.name, "is_active": c.is_active}


class CategoryImageSlotRequest(BaseModel):
    content_type: Literal["image/jpeg", "image/png", "image/webp"]


class CategoryImageUrlRequest(BaseModel):
    url: str = Field(min_length=8, max_length=512)


@router.post("/admin/categories/{category_id}/image", status_code=status.HTTP_201_CREATED)
async def category_image_slot(
    category_id: UUID, payload: CategoryImageSlotRequest, db: DbSession, actor: CatalogueAdmin
) -> dict:
    """Presigned PUT slot for the category tile image."""
    return await svc.create_category_image_slot(db, actor, category_id, content_type=payload.content_type)


@router.post("/admin/categories/{category_id}/image/url")
async def category_image_url(
    category_id: UUID, payload: CategoryImageUrlRequest, db: DbSession, actor: CatalogueAdmin
) -> dict:
    """Set the tile image from a public URL (works without object storage)."""
    return await svc.set_category_image_url(db, actor, category_id, url=payload.url)


@router.delete(
    "/admin/categories/{category_id}/image", status_code=status.HTTP_204_NO_CONTENT, response_class=Response
)
async def category_image_clear(category_id: UUID, db: DbSession, actor: CatalogueAdmin) -> Response:
    await svc.clear_category_image(db, actor, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/admin/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response
)
async def delete_category(category_id: UUID, db: DbSession, actor: CatalogueAdmin) -> Response:
    await svc.delete_category(db, actor, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Coupons ----------------------------------------------------------------------


@router.get("/admin/coupons", response_model=list[CouponOut])
async def list_coupons(db: DbSession, actor: CatalogueAdmin) -> list[CouponOut]:
    return [CouponOut.model_validate(c) for c in await svc.list_coupons(db)]


@router.post("/admin/coupons", response_model=CouponOut, status_code=status.HTTP_201_CREATED)
async def create_coupon(payload: CouponCreate, db: DbSession, actor: CatalogueAdmin) -> CouponOut:
    return CouponOut.model_validate(await svc.create_coupon(db, actor, payload.model_dump()))


@router.patch("/admin/coupons/{coupon_id}", response_model=CouponOut)
async def update_coupon(
    coupon_id: UUID, payload: CouponUpdate, db: DbSession, actor: CatalogueAdmin
) -> CouponOut:
    return CouponOut.model_validate(
        await svc.update_coupon(db, actor, coupon_id, payload.model_dump(exclude_unset=True))
    )


# --- CSV import ---------------------------------------------------------------------

# Catalogue CSVs are a few hundred KB at most; 5 MB is generous headroom while
# still keeping an unbounded `file.read()` from OOMing the process.
MAX_IMPORT_BYTES = 5 * 1024 * 1024
_CSV_CONTENT_TYPES = ("text/csv", "application/csv", "application/vnd.ms-excel")


@router.post("/admin/imports/catalogue", response_model=ImportReport)
async def import_catalogue(
    db: DbSession, actor: CatalogueAdmin, file: Annotated[UploadFile, File()]
) -> ImportReport:
    if file.content_type not in _CSV_CONTENT_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"expected a CSV upload ({', '.join(_CSV_CONTENT_TYPES)}), got {file.content_type!r}",
        )
    # Cheap reject via the declared size first, then enforce the cap while
    # reading in chunks — the declared size is client-controlled and can lie.
    if file.size is not None and file.size > MAX_IMPORT_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"CSV import is limited to {MAX_IMPORT_BYTES} bytes",
        )
    chunks: list[bytes] = []
    received = 0
    while chunk := await file.read(64 * 1024):
        received += len(chunk)
        if received > MAX_IMPORT_BYTES:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"CSV import is limited to {MAX_IMPORT_BYTES} bytes",
            )
        chunks.append(chunk)
    raw = b"".join(chunks)
    report = await svc.import_catalogue_csv(db, actor, raw)
    return ImportReport(**report)
