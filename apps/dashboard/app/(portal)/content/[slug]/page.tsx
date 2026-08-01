"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BlockForm, KIND_LABELS, KIND_TITLES, SURFACE_KINDS, blockSummary } from "@/components/content/BlockForm";
import { PageSkeleton } from "@/components/PageSkeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import {
  AccessDenied,
  type CmsBlock,
  type CmsPage,
  EmptyCard,
  ErrorCard,
  revalidateStorefront,
  surfaceFor,
  useCmsPages,
} from "../_lib";

interface FormState {
  kind: string;
  block?: CmsBlock;
  defaultSortOrder: number;
}

export default function ContentEditorPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const surface = surfaceFor(slug);
  const { can, loading: authLoading } = useAuth();
  const { pages, loading, forbidden, failed, refetch, setPages } = useCmsPages();
  const toast = useToast();

  const [form, setForm] = useState<FormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const storefrontBase = process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";

  if (authLoading || loading) return <PageSkeleton />;
  if (forbidden || !can("cms:write")) {
    return (
      <div>
        <Head slug={slug} title={surface?.title ?? slug} />
        <AccessDenied />
      </div>
    );
  }
  if (failed) {
    return (
      <div>
        <Head slug={slug} title={surface?.title ?? slug} />
        <ErrorCard onRetry={refetch} what="this surface" />
      </div>
    );
  }

  const page = (pages ?? []).find((p) => p.slug === slug) ?? null;

  function applyPage(next: CmsPage) {
    setPages((prev) => {
      const list = prev ?? [];
      return list.some((p) => p.id === next.id) ? list.map((p) => (p.id === next.id ? next : p)) : [...list, next];
    });
  }

  async function createPage() {
    setCreating(true);
    try {
      const next = await api.post<CmsPage>("/admin/cms/pages", {
        slug,
        title: surface?.title ?? slug,
        is_published: true,
      });
      applyPage(next);
      revalidateStorefront(slug);
      toast("Surface created");
    } catch {
      toast("Could not create this surface", true);
    } finally {
      setCreating(false);
    }
  }

  // --- No page yet ---
  if (!page) {
    return (
      <div>
        <Head slug={slug} title={surface?.title ?? slug} />
        <div className="card empty" style={{ display: "grid", gap: 12, justifyItems: "center", padding: "40px 20px", textAlign: "center" }}>
          <strong>This surface hasn&apos;t been set up yet</strong>
          <span className="muted small">Create it to start adding content blocks.</span>
          <button className="btn btn-primary btn-sm" onClick={createPage} disabled={creating}>
            {creating ? "Creating…" : `Create the ${surface?.title ?? slug} page`}
          </button>
        </div>
      </div>
    );
  }

  const pageId = page.id;
  const pagePublished = page.is_published;

  async function togglePublished() {
    setBusyId("__page");
    try {
      const next = await api.patch<CmsPage>(`/admin/cms/pages/${pageId}`, { is_published: !pagePublished });
      applyPage(next);
      revalidateStorefront(slug);
      toast(next.is_published ? "Surface published" : "Surface unpublished");
    } catch {
      toast("Could not update the surface", true);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(block: CmsBlock) {
    setBusyId(block.id);
    try {
      const next = await api.patch<CmsPage>(`/admin/cms/blocks/${block.id}`, { is_active: !block.is_active });
      applyPage(next);
      revalidateStorefront(slug);
      toast(block.is_active ? "Block hidden" : "Block published");
    } catch {
      toast("Could not update the block", true);
    } finally {
      setBusyId(null);
    }
  }

  async function removeBlock(block: CmsBlock) {
    setBusyId(block.id);
    try {
      const next = await api.del<CmsPage>(`/admin/cms/blocks/${block.id}`);
      applyPage(next);
      revalidateStorefront(slug);
      toast("Block deleted");
    } catch {
      toast("Could not delete the block", true);
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  }

  async function reorder(kind: string, blockId: string, dir: "up" | "down") {
    // Non-null: reorder is only reachable from the rendered UI, which returns
    // early above when `page` is null.
    const group = blocksOfKind(page!, kind);
    const idx = group.findIndex((b) => b.id === blockId);
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= group.length) return;
    const reordered = [...group];
    [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
    setBusyId(blockId);
    try {
      // Reindex the whole group to contiguous sort_order values so the new order
      // is deterministic even if the seed used duplicate/zero sort orders.
      await Promise.all(
        reordered
          .map((b, i) => (b.sort_order !== i ? api.patch(`/admin/cms/blocks/${b.id}`, { sort_order: i }) : null))
          .filter((p): p is Promise<unknown> => p !== null),
      );
      await refetch();
      revalidateStorefront(slug);
    } catch {
      toast("Could not reorder", true);
    } finally {
      setBusyId(null);
    }
  }

  const knownKinds = SURFACE_KINDS[slug] ?? [];
  const extraKinds = Array.from(new Set(page.blocks.map((b) => b.kind))).filter((k) => !knownKinds.includes(k));
  const kinds = [...knownKinds, ...extraKinds];

  return (
    <div>
      <Head slug={slug} title={surface?.title ?? page.title}>
        <a
          className="btn btn-ghost btn-sm"
          href={`${storefrontBase}${surface?.storefront ?? "/"}`}
          target="_blank"
          rel="noreferrer"
        >
          View storefront →
        </a>
        <button className="btn btn-outline btn-sm" onClick={togglePublished} disabled={busyId === "__page"}>
          {page.is_published ? "Unpublish surface" : "Publish surface"}
        </button>
      </Head>

      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <span className={`pill ${page.is_published ? "pill-ok" : "pill-muted"}`}>
          {page.is_published ? "Published" : "Draft"}
        </span>
        <span className="muted small">{page.blocks.length} blocks</span>
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        {kinds.map((kind) => {
          const group = blocksOfKind(page, kind);
          const known = knownKinds.includes(kind);
          return (
            <section className="card" key={kind}>
              <div className="row spread" style={{ alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <strong>{KIND_TITLES[kind] ?? kind}</strong>{" "}
                  <span className="muted small">· {group.length}</span>
                </div>
                {known && (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setForm({ kind, defaultSortOrder: group.length })}
                  >
                    + Add {(KIND_LABELS[kind] ?? kind).toLowerCase()}
                  </button>
                )}
              </div>

              {group.length === 0 ? (
                <div className="empty" style={{ padding: "20px 16px", color: "var(--muted)" }}>
                  No {(KIND_TITLES[kind] ?? kind).toLowerCase()} yet.
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {group.map((block, i) => (
                    <li
                      key={block.id}
                      className="row spread"
                      style={{
                        gap: 8,
                        alignItems: "center",
                        padding: "10px 16px",
                        borderTop: i === 0 ? undefined : "1px solid var(--line)",
                        opacity: block.is_active ? undefined : 0.55,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {blockSummary(kind, block.content)}
                        </div>
                        <span className={`pill ${block.is_active ? "pill-ok" : "pill-muted"}`}>
                          {block.is_active ? "Live" : "Hidden"}
                        </span>
                      </div>
                      <div className="row" style={{ gap: 4, whiteSpace: "nowrap", alignItems: "center" }}>
                        <button
                          className="icon-btn"
                          aria-label="Move up"
                          disabled={i === 0 || busyId === block.id}
                          onClick={() => reorder(kind, block.id, "up")}
                        >
                          ↑
                        </button>
                        <button
                          className="icon-btn"
                          aria-label="Move down"
                          disabled={i === group.length - 1 || busyId === block.id}
                          onClick={() => reorder(kind, block.id, "down")}
                        >
                          ↓
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => setForm({ kind, block, defaultSortOrder: group.length })}>
                          Edit
                        </button>
                        <button className="btn btn-ghost btn-sm" disabled={busyId === block.id} onClick={() => toggleActive(block)}>
                          {block.is_active ? "Hide" : "Publish"}
                        </button>
                        {confirmDelete === block.id ? (
                          <>
                            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} disabled={busyId === block.id} onClick={() => removeBlock(block)}>
                              Confirm
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => setConfirmDelete(block.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        {kinds.length === 0 && <EmptyCard>This surface has no editable block types.</EmptyCard>}
      </div>

      {form && (
        <BlockForm
          pageId={pageId}
          slug={slug}
          kind={form.kind}
          block={form.block}
          defaultSortOrder={form.defaultSortOrder}
          onClose={() => setForm(null)}
          onSaved={(next) => {
            applyPage(next);
            revalidateStorefront(slug);
            setForm(null);
          }}
        />
      )}
    </div>
  );
}

function blocksOfKind(page: CmsPage, kind: string): CmsBlock[] {
  return page.blocks
    .filter((b) => b.kind === kind)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
}

function Head({ slug, title, children }: { slug: string; title: string; children?: React.ReactNode }) {
  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/content" className="muted small" style={{ textDecoration: "none" }}>
            ← Storefront Content
          </Link>
          <h1 style={{ marginTop: 2 }}>{title}</h1>
        </div>
        {children && <div className="row" style={{ gap: 8 }}>{children}</div>}
      </div>
      <p className="muted small mono" style={{ marginTop: -6, marginBottom: 14 }}>
        {slug}
      </p>
    </>
  );
}
