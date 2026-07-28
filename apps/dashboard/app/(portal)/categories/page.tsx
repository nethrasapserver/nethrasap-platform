"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/Drawer";
import { KPI_ICONS, KpiRow } from "@/components/Kpi";
import { Pagination, paginate } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sku_prefix: string;
  glyph: string | null;
  sort_order: number;
  image_key: string | null;
  is_active: boolean;
  product_count: number;
}

export default function CategoriesPage() {
  const { data, loading, refetch } = useApi<AdminCategory[]>("/admin/categories");
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<AdminCategory | null>(null);
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const toast = useToast();
  useEffect(() => setPage(1), [query, visibility]);
  const all = data ?? [];
  const rows = all.filter((c) => {
    if (visibility === "active" && !c.is_active) return false;
    if (visibility === "hidden" && c.is_active) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.slug.includes(q) && !c.sku_prefix.toLowerCase().includes(q))
        return false;
    }
    return true;
  });
  const pageItems = paginate(rows, page, pageSize);

  async function toggleActive(c: AdminCategory) {
    try {
      await api.patch(`/admin/categories/${c.id}`, { is_active: !c.is_active });
      toast(c.is_active ? `${c.name} hidden from the storefront` : `${c.name} is live`);
      refetch();
    } catch {
      toast("Could not update the category", true);
    }
  }

  async function remove(c: AdminCategory) {
    try {
      await api.del(`/admin/categories/${c.id}`);
      toast(`${c.name} deleted`);
      refetch();
    } catch {
      toast(`Cannot delete — ${c.name} still has products. Move them first.`, true);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Categories</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setCreate(true)}>
          + New category
        </button>
      </div>

      <KpiRow
        items={[
          { label: "Categories", value: all.length, sub: "total", icon: KPI_ICONS.tag, tone: "brand" },
          { label: "Live", value: all.filter((c) => c.is_active).length, sub: "on the storefront", icon: KPI_ICONS.check, tone: "ok" },
          { label: "Hidden", value: all.filter((c) => !c.is_active).length, sub: "not shown to buyers", icon: KPI_ICONS.box, tone: "info" },
          { label: "Products", value: all.reduce((n, c) => n + c.product_count, 0), sub: "across all categories", icon: KPI_ICONS.orders, tone: "clay" },
        ]}
      />

      <div className="card pad filterbar">
        <input
          className="input fsearch"
          placeholder="Search name / slug / SKU prefix…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search categories"
        />
        <Select
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: "active", label: "Live" },
            { value: "hidden", label: "Hidden" },
          ]}
          placeholder="All visibility"
          ariaLabel="Visibility"
          width={160}
        />
        {(query || visibility) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQuery(""); setVisibility(""); }}>
            Clear
          </button>
        )}
        <span className="muted small fcount">{rows.length} of {all.length}</span>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th colSpan={2}>Category</th>
              <th>Slug</th>
              <th>SKU prefix</th>
              <th className="num">Products</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="empty">Loading…</td>
              </tr>
            )}
            {pageItems.map((c) => (
              <tr key={c.id} style={c.is_active ? undefined : { opacity: 0.55 }}>
                <td className="prod-thumb-cell">
                  <span className="prod-thumb">
                    {c.image_key ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={c.image_key} alt="" loading="lazy" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>
                    )}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  {c.description && <div className="muted small" style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</div>}
                </td>
                <td className="muted mono small">{c.slug}</td>
                <td className="muted mono small">{c.sku_prefix}</td>
                <td className="num">{c.product_count}</td>
                <td>
                  <span className={`pill ${c.is_active ? "pill-ok" : "pill-muted"}`}>
                    {c.is_active ? "Live" : "Hidden"}
                  </span>
                </td>
                <td className="num" style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setEdit(c)}>Edit</button>{" "}
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(c)}>
                    {c.is_active ? "Hide" : "Publish"}
                  </button>{" "}
                  {c.product_count === 0 && (
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => remove(c)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  {query || visibility ? "No categories match these filters." : "No categories yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={rows.length} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />

      {(create || edit) && (
        <CategoryForm
          category={edit ?? undefined}
          onClose={() => {
            setCreate(false);
            setEdit(null);
          }}
          onDone={() => {
            setCreate(false);
            setEdit(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function CategoryForm({
  category,
  onClose,
  onDone,
}: {
  category?: AdminCategory;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const editing = !!category;
  const [form, setForm] = useState({
    name: category?.name ?? "",
    sku_prefix: category?.sku_prefix ?? "",
    description: category?.description ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<string | null>(category?.image_key ?? null);
  const [imageUrl, setImageUrl] = useState("");
  const [imgBusy, setImgBusy] = useState(false);

  async function uploadImage(file: File | null) {
    if (!category || !file) return;
    setImgBusy(true);
    try {
      const slot = await api.post<{ upload_url: string; public_url: string }>(
        `/admin/categories/${category.id}/image`,
        { content_type: file.type },
      );
      const put = await fetch(slot.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("upload failed");
      setImage(slot.public_url);
      toast("Image uploaded");
    } catch {
      toast("Upload failed — storage may not be configured; paste an image URL instead", true);
    } finally {
      setImgBusy(false);
    }
  }

  async function setImageFromUrl() {
    if (!category || !imageUrl.trim()) return;
    setImgBusy(true);
    try {
      const r = await api.post<{ image_key: string }>(`/admin/categories/${category.id}/image/url`, {
        url: imageUrl.trim(),
      });
      setImage(r.image_key);
      setImageUrl("");
      toast("Image set");
    } catch {
      toast("Could not set the image", true);
    } finally {
      setImgBusy(false);
    }
  }

  async function removeImage() {
    if (!category) return;
    setImgBusy(true);
    try {
      await api.del(`/admin/categories/${category.id}/image`);
      setImage(null);
      toast("Image removed");
    } catch {
      toast("Could not remove the image", true);
    } finally {
      setImgBusy(false);
    }
  }
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true);
    const payload = {
      name: form.name,
      sku_prefix: form.sku_prefix.toUpperCase(),
      description: form.description.trim() || null,
    };
    try {
      if (editing) {
        await api.patch(`/admin/categories/${category.id}`, payload);
        toast("Category updated");
      } else {
        await api.post("/admin/categories", payload);
        toast("Category created");
      }
      onDone();
    } catch {
      toast(editing ? "Could not update the category" : "Could not create the category", true);
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={editing ? `Edit ${category.name}` : "New category"}
      subtitle={editing ? category.slug : "The slug is generated from the name."}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={busy || form.name.trim().length < 2 || !form.sku_prefix.trim()}
            onClick={save}
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Create category"}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Name</label>
        <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="field">
        <label>SKU prefix</label>
        <input
          className="input mono"
          maxLength={8}
          placeholder="e.g. RX"
          value={form.sku_prefix}
          onChange={(e) => set("sku_prefix", e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
        />
      </div>
      <div className="field">
        <label>Description (optional)</label>
        <textarea className="input" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>

      <div className="field">
        <label>Tile image</label>
        {!editing && (
          <p className="muted small" style={{ margin: 0 }}>
            Create the category first — the image can be added right after, from Edit.
          </p>
        )}
        {editing && (
          <>
            {image && (
              <div className="row" style={{ gap: 10, marginBottom: 10, alignItems: "center" }}>
                <span className="prod-thumb" style={{ width: 64, height: 64 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="" />
                </span>
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={removeImage} disabled={imgBusy}>
                  Remove
                </button>
              </div>
            )}
            <input
              className="input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={imgBusy}
              onChange={(e) => uploadImage(e.target.files?.[0] ?? null)}
            />
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="…or paste an image URL"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
              <button className="btn btn-outline btn-sm" onClick={setImageFromUrl} disabled={imgBusy || !imageUrl.trim()}>
                Set
              </button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
