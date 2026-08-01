"use client";

import Link from "next/link";
import { KPI_ICONS, KpiRow } from "@/components/Kpi";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useAuth } from "@/lib/auth";
import { AccessDenied, ErrorCard, SURFACES, useCmsPages } from "./_lib";

export default function ContentLandingPage() {
  const { can, loading: authLoading } = useAuth();
  const { pages, loading, forbidden, failed, refetch } = useCmsPages();

  if (authLoading || loading) return <PageSkeleton />;
  if (forbidden || !can("cms:write")) {
    return (
      <div>
        <div className="page-head">
          <h1>Storefront Content</h1>
        </div>
        <AccessDenied />
      </div>
    );
  }

  const bySlug = new Map((pages ?? []).map((p) => [p.slug, p]));
  const totalBlocks = (pages ?? []).reduce((n, p) => n + p.blocks.length, 0);
  const liveSurfaces = SURFACES.filter((s) => bySlug.get(s.slug)?.is_published).length;

  return (
    <div>
      <div className="page-head">
        <h1>Storefront Content</h1>
      </div>
      <p className="muted small" style={{ marginTop: -6, marginBottom: 14 }}>
        Edit the blocks that make up the public storefront. Changes go live once you publish them.
      </p>

      <KpiRow
        items={[
          { label: "Surfaces", value: SURFACES.length, sub: "editable pages", icon: KPI_ICONS.tag, tone: "brand" },
          { label: "Published", value: liveSurfaces, sub: "live to buyers", icon: KPI_ICONS.check, tone: "ok" },
          { label: "Blocks", value: totalBlocks, sub: "across all surfaces", icon: KPI_ICONS.box, tone: "info" },
        ]}
      />

      {failed ? (
        <ErrorCard onRetry={refetch} what="the storefront pages" />
      ) : (
        <div className="card-grid" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {SURFACES.map((s) => {
            const page = bySlug.get(s.slug);
            const count = page?.blocks.length ?? 0;
            return (
              <Link key={s.slug} href={`/content/${s.slug}`} className="card pad" style={{ display: "grid", gap: 8, textDecoration: "none", color: "inherit" }}>
                <div className="row spread" style={{ alignItems: "center" }}>
                  <strong style={{ fontSize: 16 }}>{s.title}</strong>
                  {page ? (
                    <span className={`pill ${page.is_published ? "pill-ok" : "pill-muted"}`}>
                      {page.is_published ? "Published" : "Draft"}
                    </span>
                  ) : (
                    <span className="pill pill-muted">Not created</span>
                  )}
                </div>
                <p className="muted small" style={{ margin: 0 }}>{s.blurb}</p>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {page ? `${count} ${count === 1 ? "block" : "blocks"}` : "Set this surface up"} →
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
