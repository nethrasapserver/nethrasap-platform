"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BlockForm, KIND_LABELS, KIND_TITLES } from "@/components/content/BlockForm";
import { SectionPreview } from "@/components/content/SectionPreview";
import { type PageSection, type SectionPart, SURFACE_SECTIONS, claimedKeys } from "@/components/content/sections";
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
  preset?: Record<string, unknown>;
  lockedKeys?: string[];
  contextLabel?: string;
}

/* Kinds whose preview is wide/singular render one-per-row; everything else is a
   compact card and packs into a responsive grid so it fills the width. */
const WIDE_KINDS = new Set([
  "hero_slide",
  "about_hero",
  "cta_band",
  "section_heading",
  "section_intro",
  "story_para",
  "announcement",
  "footer_blurb",
  "footer_column",
  "footer_legal",
  "faq_item",
  "header_nav",
  "trending",
]);

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
  const [activeSection, setActiveSection] = useState<string | null>(null);

  function jumpTo(id: string) {
    setActiveSection(id);
    if (typeof document !== "undefined") {
      document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

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

  async function reorder(group: CmsBlock[], blockId: string, dir: "up" | "down") {
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

  const sections = SURFACE_SECTIONS[slug] ?? [];
  const orphans = orphanBlocks(page, slug);
  const countIn = (section: PageSection) =>
    section.parts.reduce((n, part) => n + partBlocks(page, part).length, 0);

  return (
    <div className="cms-editor-page">
      <div className="cms-hero">
        <div className="cms-hero-main">
          <Link href="/content" className="cms-back">← Storefront Content</Link>
          <h1 className="cms-hero-title">{surface?.title ?? page.title}</h1>
          <div className="cms-hero-meta">
            <span className={`pill ${page.is_published ? "pill-ok" : "pill-muted"}`}>
              {page.is_published ? "Published" : "Draft"}
            </span>
            <span className="cms-dot">·</span>
            <span className="muted small">{sections.length} sections</span>
            <span className="cms-dot">·</span>
            <span className="muted small">{page.blocks.length} blocks</span>
            <span className="cms-dot">·</span>
            <span className="muted small mono">/{slug}</span>
          </div>
        </div>
        <div className="cms-hero-actions">
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
        </div>
      </div>

      <div className="cms-editor">
        <aside className="cms-toc">
          <div className="cms-toc-lab">Page sections</div>
          <div className="cms-toc-list">
            {sections.map((section, i) => (
              <button
                key={section.id}
                className={`cms-toc-item ${activeSection === section.id ? "on" : ""}`}
                onClick={() => jumpTo(section.id)}
              >
                <span className="cms-toc-idx">{i + 1}</span>
                <span className="cms-toc-name">{section.title}</span>
                <span className="cms-toc-count">{countIn(section)}</span>
              </button>
            ))}
            {orphans.length > 0 && (
              <button
                className={`cms-toc-item ${activeSection === "__other" ? "on" : ""}`}
                onClick={() => jumpTo("__other")}
              >
                <span className="cms-toc-idx">·</span>
                <span className="cms-toc-name">Unassigned</span>
                <span className="cms-toc-count">{orphans.length}</span>
              </button>
            )}
          </div>
        </aside>

        <div className="cms-main">
          <div className="cms-outline">
            {sections.map((section, i) => (
              <section className="cms-section" id={`sec-${section.id}`} key={section.id}>
                <div className="cms-section-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="cms-section-title">
                      <span className="cms-section-idx">{i + 1}</span>
                      {section.title}
                    </div>
                    <p className="cms-section-help">{section.help}</p>
                  </div>
                </div>

                <div className="cms-parts">
                  {section.parts.map((part) => (
                    <PartBlock
                      key={`${part.kind}:${part.slot ?? ""}`}
                      page={page}
                      part={part}
                      section={section}
                      busyId={busyId}
                      confirmDelete={confirmDelete}
                      onEdit={(block, group) =>
                        setForm({
                          kind: part.kind,
                          block,
                          defaultSortOrder: group.length,
                          preset: part.slot ? { slot: part.slot } : undefined,
                          lockedKeys: part.slot ? ["slot"] : undefined,
                          contextLabel: `${section.title} · ${partLabel(part)}`,
                        })
                      }
                      onReorder={reorder}
                      onToggle={toggleActive}
                      onDelete={removeBlock}
                      onConfirmDelete={setConfirmDelete}
                    />
                  ))}
                </div>
              </section>
            ))}

            {orphans.length > 0 && (
              <section className="cms-section" id="sec-__other" key="__other">
                <div className="cms-section-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="cms-section-title">Unassigned content</div>
                    <p className="cms-section-help">
                      Blocks that don&apos;t belong to any section on this page — usually an old or custom slot. They
                      still render if the storefront asks for them.
                    </p>
                  </div>
                </div>
                <div className="cms-grid" style={{ gridTemplateColumns: "1fr" }}>
                  {orphans.map((block) => (
                    <div className={`cms-card ${block.is_active ? "" : "is-hidden"}`} key={block.id}>
                      <div className="cms-card-body">
                        <SectionPreview kind={block.kind} content={block.content} framed={false} />
                      </div>
                      <div className="cms-card-bar">
                        <span className="pill pill-muted">
                          {KIND_LABELS[block.kind] ?? block.kind}
                          {typeof block.content?.slot === "string" ? ` · ${block.content.slot}` : ""}
                        </span>
                        <span className="cms-bar-gap" />
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setForm({ kind: block.kind, block, defaultSortOrder: 0 })}
                        >
                          Edit
                        </button>
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
              </section>
            )}

            {sections.length === 0 && <EmptyCard>This surface has no editable sections.</EmptyCard>}
          </div>
        </div>
      </div>

      {form && (
        <BlockForm
          pageId={pageId}
          slug={slug}
          kind={form.kind}
          block={form.block}
          defaultSortOrder={form.defaultSortOrder}
          preset={form.preset}
          lockedKeys={form.lockedKeys}
          contextLabel={form.contextLabel}
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

/** One part of a section: a single block (heading/intro/hero) or a list. */
function PartBlock({
  page,
  part,
  section,
  busyId,
  confirmDelete,
  onEdit,
  onReorder,
  onToggle,
  onDelete,
  onConfirmDelete,
}: {
  page: CmsPage;
  part: SectionPart;
  section: PageSection;
  busyId: string | null;
  confirmDelete: string | null;
  onEdit: (block: CmsBlock | undefined, group: CmsBlock[]) => void;
  onReorder: (group: CmsBlock[], blockId: string, dir: "up" | "down") => void;
  onToggle: (block: CmsBlock) => void;
  onDelete: (block: CmsBlock) => void;
  onConfirmDelete: (id: string | null) => void;
}) {
  const group = partBlocks(page, part);
  const label = partLabel(part);
  const singular = (KIND_LABELS[part.kind] ?? part.kind).toLowerCase();
  const multi = section.parts.length > 1;

  // --- Single-block part: the section's heading / intro / hero ---
  if (part.single) {
    const block = group[0];
    return (
      <div className="cms-part">
        {multi && (
          <div className="cms-part-head">
            <span className="cms-part-lab">{label}</span>
            {part.help && <span className="muted small">{part.help}</span>}
          </div>
        )}
        {block ? (
          <div className={`cms-card ${block.is_active ? "" : "is-hidden"}`}>
            <div className="cms-card-body">
              <SectionPreview kind={part.kind} content={block.content} framed={false} />
            </div>
            <div className="cms-card-bar">
              {!block.is_active && <span className="pill pill-muted">Hidden</span>}
              <span className="cms-bar-gap" />
              <button className="btn btn-outline btn-sm" onClick={() => onEdit(block, group)}>Edit</button>
              <button className="btn btn-ghost btn-sm" disabled={busyId === block.id} onClick={() => onToggle(block)}>
                {block.is_active ? "Hide" : "Publish"}
              </button>
              {confirmDelete === block.id ? (
                <>
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} disabled={busyId === block.id} onClick={() => onDelete(block)}>Confirm</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onConfirmDelete(null)}>Cancel</button>
                </>
              ) : (
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => onConfirmDelete(block.id)}>Delete</button>
              )}
            </div>
          </div>
        ) : (
          <button className="cms-add-first" onClick={() => onEdit(undefined, group)}>
            + Set the {multi ? label.toLowerCase() : singular}
            <span className="muted small" style={{ display: "block", fontWeight: 400 }}>
              The site shows its built-in default until you do.
            </span>
          </button>
        )}
      </div>
    );
  }

  // --- List part: cards, steps, questions … ---
  return (
    <div className="cms-part">
      <div className="cms-part-head">
        <span className="cms-part-lab">
          {label}
          <span className="cms-count">{group.length}</span>
        </span>
        {part.help && <span className="muted small">{part.help}</span>}
        <span className="cms-bar-gap" />
        <button className="btn btn-primary btn-sm" onClick={() => onEdit(undefined, group)}>
          + Add {singular}
        </button>
      </div>

      {group.length === 0 ? (
        <button className="cms-add-first" onClick={() => onEdit(undefined, group)}>
          + Add the first {singular}
        </button>
      ) : (
        <div
          className="cms-grid"
          style={{ gridTemplateColumns: WIDE_KINDS.has(part.kind) ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))" }}
        >
          {group.map((block, i) => (
            <div className={`cms-card ${block.is_active ? "" : "is-hidden"}`} key={block.id}>
              <div className="cms-card-body">
                <SectionPreview kind={part.kind} content={block.content} framed={false} />
              </div>
              <div className="cms-card-bar">
                <button className="icon-btn" aria-label="Move up" disabled={i === 0 || busyId === block.id} onClick={() => onReorder(group, block.id, "up")}>↑</button>
                <button className="icon-btn" aria-label="Move down" disabled={i === group.length - 1 || busyId === block.id} onClick={() => onReorder(group, block.id, "down")}>↓</button>
                {!block.is_active && <span className="pill pill-muted">Hidden</span>}
                <span className="cms-bar-gap" />
                <button className="btn btn-outline btn-sm" onClick={() => onEdit(block, group)}>Edit</button>
                <button className="btn btn-ghost btn-sm" disabled={busyId === block.id} onClick={() => onToggle(block)}>
                  {block.is_active ? "Hide" : "Publish"}
                </button>
                {confirmDelete === block.id ? (
                  <>
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} disabled={busyId === block.id} onClick={() => onDelete(block)}>Confirm</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => onConfirmDelete(null)}>Cancel</button>
                  </>
                ) : (
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => onConfirmDelete(block.id)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function partLabel(part: SectionPart): string {
  return part.label ?? (part.single ? KIND_LABELS[part.kind] : KIND_TITLES[part.kind]) ?? part.kind;
}

/** Blocks belonging to a part — kind, narrowed by slot when the part owns one. */
function partBlocks(page: CmsPage, part: SectionPart): CmsBlock[] {
  return page.blocks
    .filter((b) => b.kind === part.kind && (!part.slot || b.content?.slot === part.slot))
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Blocks no section claims — kept visible so content can never go missing. */
function orphanBlocks(page: CmsPage, slug: string): CmsBlock[] {
  const claimed = claimedKeys(slug);
  const slotted = new Set(
    (SURFACE_SECTIONS[slug] ?? []).flatMap((s) => s.parts.filter((p) => p.slot).map((p) => p.kind)),
  );
  return page.blocks
    .filter((b) => {
      if (slotted.has(b.kind)) {
        const slot = typeof b.content?.slot === "string" ? b.content.slot : "";
        return !claimed.has(`${b.kind}:${slot}`);
      }
      return !claimed.has(b.kind);
    })
    .slice()
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.sort_order - b.sort_order);
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
