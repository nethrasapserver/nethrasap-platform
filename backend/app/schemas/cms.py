"""CMS / settings / feature-flag schemas."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CmsBlockOut(BaseModel):
    id: UUID
    kind: str
    sort_order: int
    is_active: bool
    content: dict[str, Any]


class CmsPageOut(BaseModel):
    id: UUID
    slug: str
    title: str
    is_published: bool
    blocks: list[CmsBlockOut] = []


class PageCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=200)
    is_published: bool = True


class PageUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    is_published: bool | None = None


class BlockCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    kind: str = Field(min_length=2, max_length=50)
    sort_order: int = 0
    is_active: bool = True
    content: dict[str, Any] = {}


class BlockUpdate(BaseModel):
    kind: str | None = Field(default=None, min_length=2, max_length=50)
    sort_order: int | None = None
    is_active: bool | None = None
    content: dict[str, Any] | None = None


class CmsUploadRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    content_type: str = Field(min_length=3, max_length=100)


class SettingsPut(BaseModel):
    values: dict[str, Any] = Field(min_length=1)


class FlagPut(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    key: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9_.-]+$")
    enabled: bool
    description: str | None = Field(default=None, max_length=500)


class FlagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    enabled: bool
    description: str | None = None
