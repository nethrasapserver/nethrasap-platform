import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

/**
 * On-demand cache invalidation for CMS content. The dashboard calls this after
 * saving a page so the storefront picks up changes before the 300s revalidate
 * window elapses.
 *
 *   POST /api/revalidate?tag=cms:home
 *   Header: x-revalidate-secret: <CMS_REVALIDATE_SECRET>
 *
 * The tag may also be supplied in a JSON body ({ "tag": "cms:home" }).
 * Tags match those set in lib/content.getPage: "cms:home", "cms:about",
 * "cms:global". Returns 401 on a missing/incorrect secret, 400 without a tag.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CMS_REVALIDATE_SECRET;
  const provided = req.headers.get("x-revalidate-secret");

  // Deny if unconfigured or mismatched — never allow an unguarded flush.
  if (!secret || provided !== secret) {
    return NextResponse.json({ revalidated: false, error: "unauthorized" }, { status: 401 });
  }

  let tag = req.nextUrl.searchParams.get("tag") ?? undefined;
  if (!tag) {
    const body = (await req.json().catch(() => null)) as { tag?: unknown } | null;
    if (body && typeof body.tag === "string") tag = body.tag;
  }

  if (!tag) {
    return NextResponse.json({ revalidated: false, error: "missing tag" }, { status: 400 });
  }

  revalidateTag(tag);
  return NextResponse.json({ revalidated: true, tag, now: Date.now() });
}
