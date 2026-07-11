"""Shared response envelopes."""
from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class Paginated(BaseModel, Generic[T]):
    """Standard list-response envelope.

    Note: `Generic[T]` means the response_model on each endpoint must be
    `Paginated[ConcreteType]`.
    """

    model_config = ConfigDict(from_attributes=True)

    total: int
    limit: int
    offset: int
    items: list[T]


class ErrorResponse(BaseModel):
    detail: str
    code: str | None = None
