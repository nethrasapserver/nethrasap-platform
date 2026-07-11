"""Category response schemas."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CategoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    description: str | None = None
    sku_prefix: str
    glyph: str | None = None
    image_key: str | None = None
    sort_order: int
    is_active: bool
    product_count: int = 0
