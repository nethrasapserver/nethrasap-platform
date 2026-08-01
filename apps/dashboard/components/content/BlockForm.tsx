"use client";

import { useState } from "react";
import type { CmsBlock, CmsPage } from "@/app/(portal)/content/_lib";
import { Drawer } from "@/components/Drawer";
import { Select } from "@/components/Select";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";

// --- Field registry ----------------------------------------------------------

type FieldType = "text" | "textarea" | "select" | "image" | "links" | "terms";

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
}

const THEME_OPTIONS = [
  { value: "olive", label: "Olive" },
  { value: "cream", label: "Cream" },
  { value: "ice", label: "Ice" },
];

const TONE_OPTIONS = [
  { value: "olive", label: "Olive" },
  { value: "cream", label: "Cream" },
  { value: "ice", label: "Ice" },
  { value: "clay", label: "Clay" },
];

const FLOW_STEP: FieldDef[] = [
  { key: "title", label: "Title", type: "text", required: true },
  { key: "subtitle", label: "Subtitle", type: "text" },
  { key: "icon", label: "Icon", type: "text", placeholder: "icon name or glyph" },
];

const CTA_BAND: FieldDef[] = [
  { key: "eyebrow", label: "Eyebrow", type: "text" },
  { key: "heading", label: "Heading", type: "text", required: true },
  { key: "body", label: "Body", type: "textarea" },
  { key: "primary_label", label: "Primary button label", type: "text" },
  { key: "primary_href", label: "Primary button link", type: "text", placeholder: "/products" },
  { key: "secondary_label", label: "Secondary button label", type: "text" },
  { key: "secondary_href", label: "Secondary button link", type: "text" },
];

/** Per-kind field shapes. Client-side contract for the free-JSON `content`. */
export const FIELDS: Record<string, FieldDef[]> = {
  // --- home ---
  hero_slide: [
    { key: "eyebrow", label: "Eyebrow", type: "text" },
    { key: "title", label: "Title", type: "text", required: true },
    { key: "body", label: "Body", type: "textarea" },
    { key: "cta_label", label: "CTA label", type: "text" },
    { key: "cta_href", label: "CTA link", type: "text", placeholder: "/products" },
    { key: "alt_label", label: "Alt CTA label", type: "text" },
    { key: "alt_href", label: "Alt CTA link", type: "text" },
    { key: "theme", label: "Theme", type: "select", options: THEME_OPTIONS },
    { key: "image_url", label: "Image", type: "image" },
  ],
  trust_badge: [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "subtitle", label: "Subtitle", type: "text" },
    { key: "icon", label: "Icon", type: "text", placeholder: "icon name or glyph" },
  ],
  buyer_card: [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "body", label: "Body", type: "textarea" },
    { key: "href", label: "Link", type: "text" },
    { key: "icon", label: "Icon", type: "text", placeholder: "icon name or glyph" },
  ],
  flow_step: FLOW_STEP,
  faq_item: [
    { key: "question", label: "Question", type: "text", required: true },
    { key: "answer", label: "Answer", type: "textarea", required: true },
  ],
  section_heading: [
    { key: "slot", label: "Slot", type: "text", required: true, help: "Where on the page this heading renders." },
    { key: "heading", label: "Heading", type: "text", required: true },
    { key: "link_label", label: "Link label", type: "text" },
    { key: "link_href", label: "Link", type: "text" },
  ],
  section_intro: [
    { key: "slot", label: "Slot", type: "text", required: true, help: "Where on the page this intro renders." },
    { key: "eyebrow", label: "Eyebrow", type: "text" },
    { key: "heading", label: "Heading", type: "text", required: true },
    { key: "body", label: "Body", type: "textarea" },
  ],
  cta_band: CTA_BAND,
  // --- about ---
  about_hero: [
    { key: "eyebrow", label: "Eyebrow", type: "text" },
    { key: "title", label: "Title", type: "text", required: true },
    { key: "body", label: "Body", type: "textarea" },
    { key: "image_url", label: "Image", type: "image" },
  ],
  stat: [
    { key: "value", label: "Value", type: "text", required: true, placeholder: "e.g. 12k+" },
    { key: "label", label: "Label", type: "text", required: true },
  ],
  story_para: [{ key: "text", label: "Paragraph", type: "textarea", required: true }],
  principle: [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "body", label: "Body", type: "textarea" },
    { key: "icon", label: "Icon", type: "text", placeholder: "icon name or glyph" },
    { key: "tone", label: "Tone", type: "select", options: TONE_OPTIONS },
  ],
  founder: [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "role", label: "Role", type: "text" },
    { key: "line", label: "Bio line", type: "textarea" },
    { key: "image_url", label: "Photo", type: "image" },
  ],
  location: [
    { key: "city", label: "City", type: "text", required: true },
    { key: "role", label: "Role", type: "text" },
    { key: "note", label: "Note", type: "textarea" },
  ],
  cert: [{ key: "label", label: "Label", type: "text", required: true }],
  // --- global ---
  announcement: [{ key: "text", label: "Text", type: "text", required: true }],
  header_nav: [{ key: "links", label: "Links", type: "links", required: true }],
  trending: [{ key: "terms", label: "Terms", type: "terms", required: true }],
  footer_blurb: [{ key: "text", label: "Text", type: "textarea", required: true }],
  footer_column: [
    { key: "heading", label: "Heading", type: "text", required: true },
    { key: "items", label: "Items", type: "links" },
  ],
  footer_legal: [{ key: "text", label: "Text", type: "textarea", required: true }],
  pdp_trust_badge: [
    { key: "label", label: "Label", type: "text", required: true },
    { key: "icon", label: "Icon", type: "text", placeholder: "icon name or glyph" },
  ],
};

/** Kinds that belong to each surface, in the order they should be grouped. */
export const SURFACE_KINDS: Record<string, string[]> = {
  home: [
    "hero_slide",
    "section_heading",
    "section_intro",
    "trust_badge",
    "buyer_card",
    "flow_step",
    "faq_item",
    "cta_band",
  ],
  about: ["about_hero", "stat", "story_para", "principle", "flow_step", "founder", "location", "cert", "cta_band"],
  global: ["announcement", "header_nav", "trending", "footer_blurb", "footer_column", "footer_legal", "pdp_trust_badge"],
};

/** Singular label — used on Add/Edit buttons and drawer titles. */
export const KIND_LABELS: Record<string, string> = {
  hero_slide: "Hero slide",
  section_heading: "Section heading",
  section_intro: "Section intro",
  trust_badge: "Trust badge",
  buyer_card: "Buyer card",
  flow_step: "Flow step",
  faq_item: "FAQ item",
  cta_band: "CTA band",
  about_hero: "About hero",
  stat: "Stat",
  story_para: "Story paragraph",
  principle: "Principle",
  founder: "Founder",
  location: "Location",
  cert: "Certification",
  announcement: "Announcement",
  header_nav: "Header nav",
  trending: "Trending terms",
  footer_blurb: "Footer blurb",
  footer_column: "Footer column",
  footer_legal: "Footer legal",
  pdp_trust_badge: "PDP trust badge",
};

/** Plural label — used for group headings. */
export const KIND_TITLES: Record<string, string> = {
  hero_slide: "Hero slides",
  section_heading: "Section headings",
  section_intro: "Section intros",
  trust_badge: "Trust badges",
  buyer_card: "Buyer cards",
  flow_step: "Flow steps",
  faq_item: "FAQ items",
  cta_band: "CTA bands",
  about_hero: "About hero",
  stat: "Stats",
  story_para: "Story paragraphs",
  principle: "Principles",
  founder: "Founders",
  location: "Locations",
  cert: "Certifications",
  announcement: "Announcements",
  header_nav: "Header nav",
  trending: "Trending terms",
  footer_blurb: "Footer blurb",
  footer_column: "Footer columns",
  footer_legal: "Footer legal",
  pdp_trust_badge: "PDP trust badges",
};

export type LinkRow = { label: string; href: string };

/** A fresh, empty content object for a new block of this kind. */
export function blankContent(kind: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS[kind] ?? []) {
    if (f.type === "links") out[f.key] = [] as LinkRow[];
    else if (f.type === "terms") out[f.key] = [] as string[];
    else if (f.type === "select") out[f.key] = f.options?.[0]?.value ?? "";
    else out[f.key] = "";
  }
  return out;
}

/** One-line preview of a block for the editor list. */
export function blockSummary(kind: string, content: Record<string, unknown>): string {
  const fields = FIELDS[kind] ?? [];
  for (const f of fields) {
    if (f.type === "links") {
      const n = Array.isArray(content[f.key]) ? (content[f.key] as unknown[]).length : 0;
      return `${n} ${n === 1 ? "link" : "links"}`;
    }
    if (f.type === "terms") {
      const n = Array.isArray(content[f.key]) ? (content[f.key] as unknown[]).length : 0;
      return `${n} ${n === 1 ? "term" : "terms"}`;
    }
    const v = content[f.key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return KIND_LABELS[kind] ?? kind;
}

// --- Form --------------------------------------------------------------------

/**
 * Per-kind block editor drawer. Renders typed fields from FIELDS, validates
 * required fields client-side (the backend accepts arbitrary JSON), then
 * creates (POST /admin/cms/pages/{pageId}/blocks) or updates
 * (PATCH /admin/cms/blocks/{id}). Both endpoints return the whole page, which
 * is handed back via onSaved so the editor can update in place.
 */
export function BlockForm({
  pageId,
  slug,
  kind,
  block,
  defaultSortOrder,
  onClose,
  onSaved,
}: {
  pageId: string;
  slug: string;
  kind: string;
  /** Present when editing; absent when adding. */
  block?: CmsBlock;
  /** sort_order for a newly created block. */
  defaultSortOrder: number;
  onClose: () => void;
  onSaved: (page: CmsPage) => void;
}) {
  const toast = useToast();
  const editing = !!block;
  const fields = FIELDS[kind] ?? [];
  const [content, setContent] = useState<Record<string, unknown>>(
    () => ({ ...blankContent(kind), ...(block?.content ?? {}) }),
  );
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const set = (key: string, value: unknown) => setContent((c) => ({ ...c, [key]: value }));

  function errorFor(f: FieldDef): string | null {
    if (!f.required) return null;
    const v = content[f.key];
    if (f.type === "links") {
      const rows = (Array.isArray(v) ? v : []) as LinkRow[];
      if (rows.length === 0) return "Add at least one row.";
      if (rows.some((r) => !r.label.trim() || !r.href.trim())) return "Every row needs a label and a link.";
      return null;
    }
    if (f.type === "terms") {
      const rows = (Array.isArray(v) ? v : []) as string[];
      if (rows.filter((t) => t.trim()).length === 0) return "Add at least one term.";
      return null;
    }
    if (typeof v !== "string" || !v.trim()) return "Required.";
    return null;
  }

  const invalid = fields.some((f) => errorFor(f) !== null);

  async function uploadImage(key: string, file: File | null) {
    if (!file) return;
    setImgBusy(true);
    try {
      const slot = await api.post<{ upload_url: string; public_url: string }>("/admin/cms/uploads", {
        content_type: file.type,
      });
      const put = await fetch(slot.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("upload failed");
      set(key, slot.public_url);
      toast("Image uploaded");
    } catch {
      toast("Upload failed — storage may not be configured; paste an image URL instead", true);
    } finally {
      setImgBusy(false);
    }
  }

  async function save() {
    if (invalid) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    // Trim string fields; keep arrays as-is.
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(content)) clean[k] = typeof v === "string" ? v.trim() : v;
    try {
      const page = editing
        ? await api.patch<CmsPage>(`/admin/cms/blocks/${block.id}`, { content: clean })
        : await api.post<CmsPage>(`/admin/cms/pages/${pageId}/blocks`, {
            kind,
            sort_order: defaultSortOrder,
            is_active: true,
            content: clean,
          });
      toast(editing ? "Block updated" : `${KIND_LABELS[kind] ?? kind} added`);
      onSaved(page);
    } catch {
      toast(editing ? "Could not save the block" : "Could not add the block", true);
      setBusy(false);
    }
  }

  const label = KIND_LABELS[kind] ?? kind;

  return (
    <Drawer
      title={editing ? `Edit ${label.toLowerCase()}` : `New ${label.toLowerCase()}`}
      subtitle={`${slug} · ${kind}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy || imgBusy}>
            {busy ? "Saving…" : editing ? "Save changes" : `Add ${label.toLowerCase()}`}
          </button>
        </>
      }
    >
      {fields.map((f) => {
        const err = showErrors ? errorFor(f) : null;
        return (
          <div className="field" key={f.key}>
            <label>
              {f.label}
              {f.required && <span style={{ color: "var(--danger)" }}> *</span>}
            </label>
            {f.type === "textarea" && (
              <textarea
                className="input"
                rows={3}
                value={String(content[f.key] ?? "")}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.type === "text" && (
              <input
                className="input"
                value={String(content[f.key] ?? "")}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.type === "select" && (
              <Select
                value={String(content[f.key] ?? "")}
                onChange={(v) => set(f.key, v)}
                options={f.options ?? []}
                placeholder="Select…"
                ariaLabel={f.label}
                width={200}
              />
            )}
            {f.type === "image" && (
              <ImageField
                value={String(content[f.key] ?? "")}
                busy={imgBusy}
                onFile={(file) => uploadImage(f.key, file)}
                onUrl={(u) => set(f.key, u)}
                onClear={() => set(f.key, "")}
              />
            )}
            {f.type === "links" && (
              <LinksField
                rows={(Array.isArray(content[f.key]) ? content[f.key] : []) as LinkRow[]}
                onChange={(rows) => set(f.key, rows)}
              />
            )}
            {f.type === "terms" && (
              <TermsField
                rows={(Array.isArray(content[f.key]) ? content[f.key] : []) as string[]}
                onChange={(rows) => set(f.key, rows)}
              />
            )}
            {f.help && !err && (
              <p className="muted small" style={{ margin: "4px 0 0" }}>
                {f.help}
              </p>
            )}
            {err && (
              <p className="small" style={{ margin: "4px 0 0", color: "var(--danger)" }}>
                {err}
              </p>
            )}
          </div>
        );
      })}
    </Drawer>
  );
}

function ImageField({
  value,
  busy,
  onFile,
  onUrl,
  onClear,
}: {
  value: string;
  busy: boolean;
  onFile: (file: File | null) => void;
  onUrl: (url: string) => void;
  onClear: () => void;
}) {
  const [url, setUrl] = useState("");
  return (
    <>
      {value && (
        <div className="row" style={{ gap: 10, marginBottom: 10, alignItems: "center" }}>
          <span className="prod-thumb" style={{ width: 64, height: 64 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" />
          </span>
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={onClear} disabled={busy}>
            Remove
          </button>
        </div>
      )}
      <input
        className="input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="…or paste an image URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          className="btn btn-outline btn-sm"
          disabled={busy || !url.trim()}
          onClick={() => {
            onUrl(url.trim());
            setUrl("");
          }}
        >
          Set
        </button>
      </div>
    </>
  );
}

function LinksField({ rows, onChange }: { rows: LinkRow[]; onChange: (rows: LinkRow[]) => void }) {
  const update = (i: number, patch: Partial<LinkRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r, i) => (
        <div className="row" key={i} style={{ gap: 8, alignItems: "center" }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Label"
            value={r.label}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="/link or https://…"
            value={r.href}
            onChange={(e) => update(i, { href: e.target.value })}
          />
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--danger)" }}
            aria-label={`Remove row ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <div>
        <button className="btn btn-outline btn-sm" onClick={() => onChange([...rows, { label: "", href: "" }])}>
          + Add row
        </button>
      </div>
    </div>
  );
}

function TermsField({ rows, onChange }: { rows: string[]; onChange: (rows: string[]) => void }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((t, i) => (
        <div className="row" key={i} style={{ gap: 8, alignItems: "center" }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Term"
            value={t}
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--danger)" }}
            aria-label={`Remove term ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <div>
        <button className="btn btn-outline btn-sm" onClick={() => onChange([...rows, ""])}>
          + Add term
        </button>
      </div>
    </div>
  );
}
