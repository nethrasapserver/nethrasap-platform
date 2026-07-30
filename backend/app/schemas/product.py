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
    """All money is tax-INCLUSIVE paise. `gst_amount` is the tax contained
    within `selling_price` — computed server-side so the UI never re-derives
    tax and drifts from what checkout actually charges."""

    model_config = ConfigDict(from_attributes=True)

    role: Literal["customer", "clinician", "retailer"]
    mrp: int
    selling_price: int
    # Indicative band for quote-only products (tax-inclusive paise); null = fixed.
    range_min: int | None = None
    range_max: int | None = None
    gst_rate_pct: int = 12
    gst_amount: int = 0
    currency: str = "INR"


class ProductVariantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pack_size: str
    unit_label: str
    barcode: str | None = None
    is_default: bool
    # Live units sellable right now: SUM(on_hand - reserved) across warehouses.
    # None = variant is UNTRACKED (no stock_levels rows) — the frontend falls
    # back to the product-level `stock_status` instead of a unit count.
    available_units: int | None = None
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
    # Default variant for direct add-to-cart from product cards (card stepper).
    default_variant_id: UUID | None = None
    # Primary product image (storage key / URL); null until one is uploaded.
    image_key: str | None = None
    category_slug: str
    category_name: str
    sub_category: str | None = None
    stock_status: Literal["in_stock", "low_stock", "out_of_stock", "discontinued"]
    rating: float
    reviews: int = Field(serialization_alias="reviews")
    # Tax-inclusive price band for the caller's role, across the product's pack
    # sizes: price_min = cheapest pack, price_max = dearest. `mrp` carries the
    # strike-through for the default pack (it is NOT the band's ceiling).
    price_min: int
    price_max: int
    mrp: int = 0
    gst_rate_pct: int = 12
    # True when the default variant carries an indicative band → buying raises a
    # quote instead of a direct sale. Fixed-price products check out as normal.
    is_quote_only: bool = False
    is_featured: bool
    badge: str | None = None
    delivery_time_mins: int | None = None
    unit_label: str
    schedule: Literal["NONE", "H", "H1", "X"] = "NONE"


class ProductInfo(BaseModel):
    """Product-information block shown under the PDP description.

    Sourced from the product's free-form `attributes`; every field is optional
    so partially-filled products still render (the frontend fills sensible
    fallbacks). `dosage_timing` is a list of `morning` / `afternoon` / `night`.
    """

    uses: str | None = None
    composition: str | None = None
    directions: str | None = None
    dosage_timing: list[str] = []
    storage: str | None = None
    warnings: str | None = None
    manufacturer: str | None = None
    country_of_origin: str | None = None
    mfg_date: str | None = None
    expiry_date: str | None = None
    shelf_life_months: int | None = None
    prescription_required: bool = False


class ProductDetail(ProductListItem):
    """PDP response — adds variants, images, full specs."""

    description: str | None = None
    hsn_code: str | None = None
    specs: list[dict] = []
    # Free-form product attributes (JSONB) passed through verbatim — benefits /
    # indications / dosage / tags / manufacturer etc. live here, no columns.
    attributes: dict = {}
    info: ProductInfo = Field(default_factory=ProductInfo)
    variants: list[ProductVariantOut] = []
    images: list[ProductImageOut] = []
