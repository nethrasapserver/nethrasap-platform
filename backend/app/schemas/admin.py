"""Admin catalogue schemas — products, variants, prices, images, categories, coupons."""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Schedule = Literal["H", "H1", "X", "NONE"]
StockStatusIn = Literal["in_stock", "low_stock", "out_of_stock"]
PriceRoleIn = Literal["customer", "clinician", "retailer"]


# --- Products ----------------------------------------------------------------


class ProductCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=255)
    slug: str | None = Field(default=None, max_length=150, pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    category_slug: str
    sub_category: str | None = Field(default=None, max_length=80)
    schedule: Schedule = "NONE"
    hsn_code: str | None = Field(default=None, max_length=12)
    stock_status: StockStatusIn = "in_stock"
    is_active: bool = True
    is_featured: bool = False
    badge: str | None = Field(default=None, max_length=50)
    gst_rate_pct: int = Field(default=12, ge=0, le=28)
    dispatch_sla_hours: int | None = Field(default=None, ge=0)
    delivery_time_mins: int | None = Field(default=None, ge=0)
    specs: list = []
    attributes: dict = {}


class ProductUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    category_slug: str | None = None
    sub_category: str | None = Field(default=None, max_length=80)
    schedule: Schedule | None = None
    hsn_code: str | None = Field(default=None, max_length=12)
    stock_status: StockStatusIn | None = None
    is_active: bool | None = None
    is_featured: bool | None = None
    badge: str | None = Field(default=None, max_length=50)
    gst_rate_pct: int | None = Field(default=None, ge=0, le=28)
    dispatch_sla_hours: int | None = Field(default=None, ge=0)
    delivery_time_mins: int | None = Field(default=None, ge=0)
    specs: list | None = None
    attributes: dict | None = None


class PriceIn(BaseModel):
    role: PriceRoleIn
    mrp: int = Field(gt=0, description="paise")
    selling_price: int = Field(gt=0, description="paise")
    # Optional indicative band → makes the product quote-only for this role.
    range_min: int | None = Field(default=None, ge=0, description="paise")
    range_max: int | None = Field(default=None, ge=0, description="paise")


class VariantCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    pack_size: str = Field(min_length=1, max_length=80)
    unit_label: str = Field(min_length=1, max_length=120)
    barcode: str | None = Field(default=None, max_length=64)
    weight_g: int | None = Field(default=None, gt=0)
    is_default: bool = False
    sort_order: int = 0
    prices: list[PriceIn] = Field(min_length=1)


class VariantUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    pack_size: str | None = Field(default=None, min_length=1, max_length=80)
    unit_label: str | None = Field(default=None, min_length=1, max_length=120)
    barcode: str | None = Field(default=None, max_length=64)
    weight_g: int | None = Field(default=None, gt=0)
    is_default: bool | None = None
    sort_order: int | None = None
    prices: list[PriceIn] | None = None


class ImageSlotRequest(BaseModel):
    content_type: Literal["image/jpeg", "image/png", "image/webp"]
    alt: str | None = Field(default=None, max_length=255)
    is_primary: bool = False


class ImageSlotResponse(BaseModel):
    image_id: UUID
    storage_key: str
    upload_url: str
    public_url: str
    expires_in: int


class ImageUrlRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    url: str = Field(min_length=4, max_length=1024)
    alt: str | None = Field(default=None, max_length=255)
    is_primary: bool = False


class AdminVariantOut(BaseModel):
    id: UUID
    pack_size: str
    unit_label: str
    barcode: str | None
    is_default: bool
    sort_order: int
    prices: list[PriceIn]


class AdminProductOut(BaseModel):
    id: UUID
    slug: str
    name: str
    category_slug: str
    sub_category: str | None
    schedule: str
    stock_status: str
    is_active: bool
    is_featured: bool
    gst_rate_pct: int
    variants: list[AdminVariantOut] = []
    images: list[dict] = []


# --- Categories --------------------------------------------------------------


class CategoryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=80, pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    sku_prefix: str = Field(min_length=1, max_length=8)
    glyph: str | None = Field(default=None, max_length=50)
    sort_order: int = 0
    parent_slug: str | None = None
    is_active: bool = True


class CategoryUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = None
    sku_prefix: str | None = Field(default=None, min_length=1, max_length=8)
    glyph: str | None = Field(default=None, max_length=50)
    sort_order: int | None = None
    is_active: bool | None = None


# --- Coupons -----------------------------------------------------------------


class CouponCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    code: str = Field(min_length=3, max_length=40, pattern=r"^[A-Z0-9_-]+$")
    type: Literal["percent", "flat"]
    value: int = Field(gt=0, description="percent (1-100) or paise")
    min_order: int = Field(default=0, ge=0, description="paise")
    max_uses: int | None = Field(default=None, gt=0)
    expires_at: datetime | None = None
    is_active: bool = True


class CouponUpdate(BaseModel):
    value: int | None = Field(default=None, gt=0)
    min_order: int | None = Field(default=None, ge=0)
    max_uses: int | None = Field(default=None, gt=0)
    expires_at: datetime | None = None
    is_active: bool | None = None


class CouponOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    type: str  # "percent" | "flat" — ORM hands us CouponType members
    value: int
    min_order: int
    max_uses: int | None
    used_count: int
    expires_at: datetime | None
    is_active: bool


# --- CSV import ---------------------------------------------------------------


class ImportRowError(BaseModel):
    row: int
    error: str


class ImportReport(BaseModel):
    total_rows: int
    products_created: int
    products_updated: int
    variants_created: int
    prices_set: int
    errors: list[ImportRowError] = []
