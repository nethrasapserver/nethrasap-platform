"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BlockForm, KIND_HELP, KIND_LABELS, KIND_TITLES, SURFACE_KINDS } from "@/components/content/BlockForm";
import { BlockPreview } from "@/components/content/BlockPreview";
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

      <p className="muted small" style={{ marginTop: -6, marginBottom: 18 }}>
        Each section below is a part of the live {surface?.title ?? "page"}. Add, edit, reorder, hide or delete
        its blocks — previews show roughly how they read on the site.
      </p>

      <div className="cms-outline">
        {kinds.map((kind) => {
          const group = blocksOfKind(page, kind);
          const known = knownKinds.includes(kind);
          const label = (KIND_LABELS[kind] ?? kind).toLowerCase();
          return (
            <section className="cms-section" key={kind}>
              <div className="cms-section-head">
                <div style={{ minWidth: 0 }}>
                  <div className="cms-section-title">
                    {KIND_TITLES[kind] ?? kind}
                    <span className="cms-count">{group.length}</span>
                  </div>
                  {KIND_HELP[kind] && <p className="cms-section-help">{KIND_HELP[kind]}</p>}
                </div>
                {known && (
                  <button className="btn btn-primary btn-sm" onClick={() => setForm({ kind, defaultSortOrder: group.length })}>
                    + Add {label}
                  </button>
                )}
              </div>

              {group.length === 0 ? (
                known ? (
                  <button className="cms-add-first" onClick={() => setForm({ kind, defaultSortOrder: 0 })}>
                    + Add the first {label}
                  </button>
                ) : (
                  <div className="cms-empty">No {(KIND_TITLES[kind] ?? kind).toLowerCase()} yet.</div>
                )
              ) : (
                <div className="cms-blocks">
                  {group.map((block, i) => (
                    <div className={`cms-block ${block.is_active ? "" : "is-hidden"}`} key={block.id}>
                      <div className="cms-reorder">
                        <button className="icon-btn" aria-label="Move up" disabled={i === 0 || busyId === block.id} onClick={() => reorder(kind, block.id, "up")}>↑</button>
                        <button className="icon-btn" aria-label="Move down" disabled={i === group.length - 1 || busyId === block.id} onClick={() => reorder(kind, block.id, "down")}>↓</button>
                      </div>
                      <div className="cms-block-body">
                        <BlockPreview kind={kind} content={block.content} />
                      </div>
                      <div className="cms-block-ctrls">
                        {!block.is_active && <span className="pill pill-muted">Hidden</span>}
                        <button className="btn btn-outline btn-sm" onClick={() => setForm({ kind, block, defaultSortOrder: group.length })}>Edit</button>
                        <button className="btn btn-ghost btn-sm" disabled={busyId === block.id} onClick={() => toggleActive(block)}>
                          {block.is_active ? "Hide" : "Publish"}
                        </button>
                        {confirmDelete === block.id ? (
                          <>
                            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} disabled={busyId === block.id} onClick={() => removeBlock(block)}>Confirm</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                          </>
                        ) : (
                          <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => setConfirmDelete(block.id)}>Delete</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
