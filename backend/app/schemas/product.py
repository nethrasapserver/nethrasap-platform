"""Product schemas — list + detail response shapes.

The list schema matches the field names that the existing JSX components on
the frontend already consume from `data.js` (`category_slug`, `price_min`,
`stock_status`, etc.) so wiring an `<HomeFeatured />` through the API doesn't
need any component changes.
"""
from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductPriceRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role: Literal["customer", "clinician", "retailer"]
    mrp: int
    selling_price: int
    currency: str = "INR"


class ProductVariantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pack_size: str
    unit_label: str
    barcode: str | None = None
    is_default: bool
    prices: list[ProductPriceRow] = []


class ProductImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    storage_key: str
    alt: str | None = None
    is_primary: bool
    sort_order: int


class ProductListItem(BaseModel):
    """Catalogue row — backwards-compatible with the existing JSX cards."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    brand: str
    category_slug: str
    category_name: str
    sub_category: str | None = None
    stock_status: Literal["in_stock", "low_stock", "out_of_stock", "discontinued"]
    rating: float
    reviews: int = Field(serialization_alias="reviews")
    price_min: int
    price_max: int
    is_featured: bool
    badge: str | None = None
    delivery_time_mins: int | None = None
    unit_label: str
    schedule: Literal["NONE", "H", "H1", "X"] = "NONE"


class ProductDetail(ProductListItem):
    """PDP response — adds variants, images, full specs."""

    description: str | None = None
    hsn_code: str | None = None
    specs: list[dict] = []
    variants: list[ProductVariantOut] = []
    images: list[ProductImageOut] = []
