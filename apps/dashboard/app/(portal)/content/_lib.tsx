"use client";

import { ApiError } from "@nethrasap/api-client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

/** A single CMS block. `content` is free-form JSON — the per-kind shape is
    enforced client-side by components/content/BlockForm. */
export interface CmsBlock {
  id: string;
  kind: string;
  sort_order: number;
  is_active: boolean;
  content: Record<string, unknown>;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  is_published: boolean;
  blocks: CmsBlock[];
}

/** The three storefront surfaces this editor manages, in landing-card order. */
export const SURFACES: { slug: string; title: string; blurb: string; storefront: string }[] = [
  {
    slug: "home",
    title: "Home",
    blurb: "Hero slides, section intros, trust badges, buyer cards, the buying flow and FAQs.",
    storefront: "/",
  },
  {
    slug: "about",
    title: "About",
    blurb: "Company story, stats, principles, the team and where we operate.",
    storefront: "/about",
  },
  {
    slug: "global",
    title: "Global",
    blurb: "Announcement bar, header nav, trending terms and the site footer.",
    storefront: "/",
  },
];

export function surfaceFor(slug: string) {
  return SURFACES.find((s) => s.slug === slug);
}

/**
 * Admin CMS fetch. Reads GET /admin/cms/pages (the admin list — it returns
 * *all* pages including unpublished ones and inactive blocks, unlike the public
 * GET /cms/pages/{slug}). Distinguishes a 403 permission wall from a generic
 * failure so callers can render access-denied rather than an empty console
 * (H-13). `setPages` lets views apply the page an admin write returns.
 */
export function useCmsPages() {
  const [pages, setPages] = useState<CmsPage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [failed, setFailed] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    setFailed(false);
    try {
      setPages(await api.get<CmsPage[]>("/admin/cms/pages"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
      else setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { pages, loading, forbidden, failed, refetch, setPages };
}

/**
 * Ask the storefront to drop its cache for this surface after a CMS write.
 * Best-effort: the storefront route (`/api/revalidate`) and the shared secret
 * are wired by the integrator. A failure here — route not built yet, no secret,
 * CORS — must never block or fail a save, so it is swallowed.
 *
 * Env (build-time inlined, NEXT_PUBLIC_* so it is readable in the browser):
 *   NEXT_PUBLIC_STOREFRONT_URL   default http://localhost:3000
 *   NEXT_PUBLIC_REVALIDATE_SECRET sent as the x-revalidate-secret header
 */
export async function revalidateStorefront(slug: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";
  const secret = process.env.NEXT_PUBLIC_REVALIDATE_SECRET;
  try {
    await fetch(`${base}/api/revalidate?tag=cms:${encodeURIComponent(slug)}`, {
      method: "POST",
      mode: "cors",
      keepalive: true,
      headers: secret ? { "x-revalidate-secret": secret } : undefined,
    });
  } catch {
    /* best-effort — integrator owns the storefront revalidate route + secret */
  }
}

const centered: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 8,
  justifyItems: "center",
  textAlign: "center",
  padding: "40px 20px",
};

/** Permission wall — the API returned 403, or the user lacks cms:write. */
export function AccessDenied() {
  return (
    <div className="card empty" style={centered}>
      <strong>You don&apos;t have access to Storefront Content</strong>
      <span className="muted small">
        Editing the storefront needs the content permission. Ask an admin if you need it.
      </span>
    </div>
  );
}

/** Generic load failure with a retry. */
export function ErrorCard({ onRetry, what }: { onRetry: () => void; what: string }) {
  return (
    <div className="card empty" style={{ ...centered, gap: 12 }}>
      <span>Could not load {what}.</span>
      <button className="btn btn-outline btn-sm" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

/** Neutral empty state. */
export function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="card empty" style={centered}>
      <span className="muted">{children}</span>
    </div>
  );
}
