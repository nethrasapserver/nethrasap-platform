"""Media proxy — serves public storage objects through the api.

Used in local dev: STORAGE_PUBLIC_BASE_URL is set to `/api/v1/media`, so image
URLs are same-origin (browser → frontend → api → storage). The browser never
has to reach the storage host directly, which is unreliable across environments.
In production STORAGE_PUBLIC_BASE_URL is the R2/CDN domain, so this route is
simply never referenced.

Only the public catalogue/CMS prefixes are served — private objects (kyc/,
invoices/, payslips/) are never exposed here; those use short-lived signed GETs.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status

from ...integrations import storage

router = APIRouter()

_PUBLIC_PREFIXES = ("cms/", "products/", "categories/")


@router.get("/media/{key:path}")
async def get_media(key: str) -> Response:
    if not key.startswith(_PUBLIC_PREFIXES):
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    got = await storage.get_bytes_async(key)
    if got is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    data, content_type = got
    return Response(content=data, media_type=content_type, headers={"Cache-Control": "public, max-age=3600"})
