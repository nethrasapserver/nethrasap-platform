"use client";

import type { ProductDetail, Schemas } from "@nethrasap/api-client";
import { useEffect, useRef, useState } from "react";
import { Drawer } from "@/components/Drawer";
import { KPI_ICONS, KpiRow } from "@/components/Kpi";
import { Pagination, paginate } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { api } from "@/lib/api";
import { inr, statusPill, toPaise, toRupeeInput } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface ProductImg {
  id: string;
  storage_key: string;
  alt: string | null;
  is_primary: boolean;
}

/* Admin list row — includes unpublished products the public API hides.
   GET /admin/products has no response_model (it returns raw dicts from
   backend/app/services/admin_catalogue.py:list_products_admin), so the
   generated AdminProductOut — which models serialise_admin_product, used by
   the create/update/publish endpoints — is missing the list-only fields
   added below, and carries `variants` + untyped `images` the list rows
   don't have. Drop the extension once the backend types the list response. */
type AdminProduct = Omit<Schemas["AdminProductOut"], "variants" | "images"> & {
  image_key: string | null;
  category_name: string;
  variant_count: number;
  price_min: number | null;
  description: string | null;
  attributes: Record<string, unknown>;
  images: ProductImg[];
};

const DOSE_SLOTS = ["morning", "afternoon", "night"] as const;

const SCHEDULES = ["NONE", "H", "H1", "X"] as const;
const STOCK = ["in_stock", "low_stock", "out_of_stock"] as const;

type StatusFilter = "all" | "live" | "draft" | "oos";

export default function CataloguePage() {
  const { data, loading, refetch } = useApi<AdminProduct[]>("/admin/products");
  const cats = useApi<{ items: Category[] }>("/categories", { limit: 50 });
  const categories = cats.data?.items ?? [];
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<AdminProduct | null>(null);
  const [priceFor, setPriceFor] = useState<AdminProduct | null>(null);
  const [variantFor, setVariantFor] = useState<AdminProduct | null>(null);
  const [view, setView] = useState<AdminProduct | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [catFilter, setCatFilter] = useState("");
  const toast = useToast();

  async function toggleActive(p: AdminProduct) {
    try {
      await api.post(`/admin/products/${p.id}/${p.is_active ? "unpublish" : "publish"}`);
      toast(p.is_active ? `${p.name} unpublished` : `${p.name} published`);
      refetch();
    } catch {
      toast("Could not update the product", true);
    }
  }

  const all = data ?? [];
  const stats = {
    total: all.length,
    live: all.filter((p) => p.is_active).length,
    draft: all.filter((p) => !p.is_active).length,
    oos: all.filter((p) => p.stock_status === "out_of_stock").length,
  };
  const q = query.trim().toLowerCase();
  const products = all.filter((p) => {
    if (statusFilter === "live" && !p.is_active) return false;
    if (statusFilter === "draft" && p.is_active) return false;
    if (statusFilter === "oos" && p.stock_status !== "out_of_stock") return false;
    if (catFilter && p.category_slug !== catFilter) return false;
    if (q && !(p.name.toLowerCase().includes(q) || p.category_name.toLowerCase().includes(q))) return false;
    return true;
  });

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  // Any change to the filters resets to the first page.
  useEffect(() => setPage(1), [query, statusFilter, catFilter]);
  const pageItems = paginate(products, page, pageSize);


  return (
    <div>
      <div className="page-head">
        <h1>Products</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setCreate(true)}>
          + New product
        </button>
      </div>

      {/* KPI cards double as status filters */}
      <KpiRow
        items={[
          { label: "All products", value: stats.total, sub: "in the catalogue", icon: KPI_ICONS.tag, tone: "brand", onClick: () => setStatusFilter("all") },
          { label: "Live", value: stats.live, sub: "visible on the storefront", icon: KPI_ICONS.eye, tone: "ok", onClick: () => setStatusFilter("live"), active: statusFilter === "live" },
          { label: "Drafts", value: stats.draft, sub: "unpublished", icon: KPI_ICONS.box, tone: "info", onClick: () => setStatusFilter("draft"), active: statusFilter === "draft" },
          { label: "Out of stock", value: stats.oos, sub: "need replenishment", icon: KPI_ICONS.warn, tone: "danger", onClick: () => setStatusFilter("oos"), active: statusFilter === "oos" },
        ]}
      />

      {/* Toolbar */}
      <div className="card pad filterbar">
        <input
          className="input fsearch"
          placeholder="Search products or category…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search products"
        />
        <Select
          value={catFilter}
          onChange={setCatFilter}
          options={categories.map((c) => ({ value: c.slug, label: c.name }))}
          placeholder="All categories"
          ariaLabel="Category"
          width={190}
        />
        {(query || catFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQuery(""); setCatFilter(""); }}>
            Clear
          </button>
        )}
        <span className="muted small fcount">
          {products.length} of {all.length}
        </span>
      </div>

      <div className="card">
        <table className="tbl prod-table">
          <thead>
            <tr>
              <th colSpan={2}>Product</th>
              <th>Category</th>
              <th className="num">Variants</th>
              <th>Stock</th>
              <th>Status</th>
              <th className="num">Price</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="empty">Loading…</td></tr>
            )}
            {pageItems.map((p) => (
              <tr
                key={p.id}
                className={p.is_active ? "" : "is-draft"}
                onClick={() => setView(p)}
                onKeyDown={(e) => e.key === "Enter" && setView(p)}
                tabIndex={0}
                style={{ cursor: "pointer" }}
              >
                <td className="prod-thumb-cell">
                  <span className="prod-thumb">
                    {p.image_key ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.image_key} alt="" loading="lazy" />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" /></svg>
                    )}
                  </span>
                </td>
                <td>
                  <div className="prod-name">{p.name}</div>
                  <div className="prod-tags">
                    {p.is_featured && <span className="mini-tag t-feat">Featured</span>}
                    {p.schedule !== "NONE" && <span className="mini-tag t-rx">Rx · {p.schedule}</span>}
                    {p.sub_category && <span className="mini-tag t-sub">{p.sub_category}</span>}
                  </div>
                </td>
                <td className="muted">{p.category_name}</td>
                <td className="num muted">{p.variant_count}</td>
                <td><span className={`pill ${statusPill(p.stock_status)}`}>{p.stock_status.replace(/_/g, " ")}</span></td>
                <td><span className={`pill ${p.is_active ? "pill-ok" : "pill-muted"}`}>{p.is_active ? "Live" : "Draft"}</span></td>
                <td className="num" style={{ fontWeight: 600 }}>{p.price_min != null ? inr(p.price_min) : "—"}</td>
                <td className="num">
                  <div className="prod-actions">
                    <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); setEdit(p); }}>Edit</button>
                    <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); setPriceFor(p); }}>Prices</button>
                    <RowMenu
                      isActive={p.is_active}
                      onVariant={() => setVariantFor(p)}
                      onToggle={() => toggleActive(p)}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!loading && products.length === 0 && (
              <tr><td colSpan={8} className="empty">
                {all.length === 0 ? "No products yet." : "No products match your filters."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={products.length} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />

      {view && (
        <ProductViewDrawer
          product={view}
          onClose={() => setView(null)}
          onEdit={() => { setEdit(view); setView(null); }}
          onPrices={() => { setPriceFor(view); setView(null); }}
          onToggle={() => { toggleActive(view); setView(null); }}
        />
      )}

      {create && (
        <ProductForm
          categories={categories}
          onClose={() => setCreate(false)}
          onDone={() => {
            setCreate(false);
            refetch();
          }}
        />
      )}
      {edit && (
        <ProductForm
          categories={categories}
          product={edit}
          onClose={() => setEdit(null)}
          onDone={() => {
            setEdit(null);
            refetch();
          }}
        />
      )}
      {priceFor && (
        <PriceEditor
          product={priceFor}
          onClose={() => setPriceFor(null)}
          onDone={() => {
            setPriceFor(null);
            refetch();
          }}
          onAddVariant={() => {
            setVariantFor(priceFor);
            setPriceFor(null);
          }}
        />
      )}
      {variantFor && (
        <VariantForm
          product={variantFor}
          onClose={() => setVariantFor(null)}
          onDone={() => {
            setVariantFor(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

/* ---------- Row overflow menu (secondary actions) ---------- */

function RowMenu({ isActive, onVariant, onToggle }: { isActive: boolean; onVariant: () => void; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="rowmenu" ref={ref}>
      <button className="rowmenu-trigger" aria-label="More actions" onClick={() => setOpen((o) => !o)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
      </button>
      {open && (
        <div className="rowmenu-pop" role="menu">
          <button role="menuitem" onClick={() => { setOpen(false); onVariant(); }}>+ Add variant</button>
          <button role="menuitem" onClick={() => { setOpen(false); onToggle(); }}>
            {isActive ? "Unpublish" : "Publish"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Create / edit product ---------- */

function ProductForm({
  categories,
  product,
  onClose,
  onDone,
}: {
  categories: Category[];
  product?: AdminProduct;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const editing = !!product;
  const a = (product?.attributes ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
  const [form, setForm] = useState({
    name: product?.name ?? "",
    category_slug: product?.category_slug || (categories[0]?.slug ?? ""),
    sub_category: product?.sub_category ?? "",
    schedule: product?.schedule ?? "NONE",
    stock_status: product?.stock_status ?? "in_stock",
    gst_rate_pct: String(product?.gst_rate_pct ?? 12),
    is_featured: product?.is_featured ?? false,
    description: product?.description ?? "",
    // Product-information fields (stored in attributes).
    uses: str("uses"),
    composition: str("composition"),
    directions: str("directions"),
    storage: str("storage"),
    warnings: str("warnings"),
    manufacturer: str("manufacturer"),
    country_of_origin: str("country_of_origin"),
    mfg_date: str("mfg_date"),
    expiry_date: str("expiry_date"),
  });
  const [dosage, setDosage] = useState<string[]>(
    Array.isArray(a.dosage_timing) ? (a.dosage_timing as string[]) : [],
  );
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDose = (slot: string) =>
    setDosage((d) => (d.includes(slot) ? d.filter((x) => x !== slot) : [...d, slot]));

  // Image management (immediate, independent of the Save button).
  const [images, setImages] = useState<ProductImg[]>(product?.images ?? []);
  const [imgUrl, setImgUrl] = useState("");
  const [imgBusy, setImgBusy] = useState(false);

  // Pending images (new-product mode) get a temp id and are attached on create.
  const removeLocalPrimary = (xs: ProductImg[], id: string) => {
    const rest = xs.filter((x) => x.id !== id);
    if (!rest.some((x) => x.is_primary) && rest[0]) rest[0] = { ...rest[0], is_primary: true };
    return rest;
  };

  async function addImage() {
    const url = imgUrl.trim();
    if (!url) return;
    if (editing && product) {
      setImgBusy(true);
      try {
        const img = await api.post<ProductImg>(`/admin/products/${product.id}/images/url`, {
          url,
          is_primary: images.length === 0,
        });
        setImages((xs) => [...xs.map((x) => ({ ...x, is_primary: img.is_primary ? false : x.is_primary })), img]);
        setImgUrl("");
      } catch {
        toast("Could not add the image — check the URL", true);
      } finally {
        setImgBusy(false);
      }
    } else {
      // Buffer locally; attached after the product is created.
      setImages((xs) => [
        ...xs,
        { id: `pending-${xs.length}-${url.slice(-8)}`, storage_key: url, alt: null, is_primary: xs.length === 0 },
      ]);
      setImgUrl("");
    }
  }
  async function removeImage(id: string) {
    if (editing && !id.startsWith("pending-")) {
      try {
        await api.del(`/admin/images/${id}`);
      } catch {
        toast("Could not remove the image", true);
        return;
      }
    }
    setImages((xs) => removeLocalPrimary(xs, id));
  }
  async function makePrimary(id: string) {
    if (editing && !id.startsWith("pending-")) {
      try {
        await api.patch(`/admin/images/${id}/primary`, {});
      } catch {
        toast("Could not set the primary image", true);
        return;
      }
    }
    setImages((xs) => xs.map((x) => ({ ...x, is_primary: x.id === id })));
  }

  async function save() {
    setBusy(true);
    const attributes: Record<string, unknown> = { ...a };
    const setAttr = (k: string, v: string) => {
      if (v.trim()) attributes[k] = v.trim();
      else delete attributes[k];
    };
    setAttr("uses", form.uses);
    setAttr("composition", form.composition);
    setAttr("directions", form.directions);
    setAttr("storage", form.storage);
    setAttr("warnings", form.warnings);
    setAttr("manufacturer", form.manufacturer);
    setAttr("country_of_origin", form.country_of_origin);
    setAttr("mfg_date", form.mfg_date);
    setAttr("expiry_date", form.expiry_date);
    attributes.dosage_timing = dosage;

    const payload: Record<string, unknown> = {
      name: form.name,
      category_slug: form.category_slug,
      sub_category: form.sub_category.trim() || null,
      schedule: form.schedule,
      stock_status: form.stock_status,
      gst_rate_pct: Number(form.gst_rate_pct) || 0,
      is_featured: form.is_featured,
      description: form.description.trim() || null,
      attributes,
    };
    try {
      if (editing) {
        await api.patch(`/admin/products/${product.id}`, payload);
        toast("Product updated");
      } else {
        const created = await api.post<{ id: string }>("/admin/products", payload);
        // Attach any images the user buffered while creating.
        for (const im of images) {
          await api.post(`/admin/products/${created.id}/images/url`, {
            url: im.storage_key,
            is_primary: im.is_primary,
          });
        }
        toast("Product created — add variants & prices next");
      }
      onDone();
    } catch {
      toast(editing ? "Could not update the product" : "Could not create the product", true);
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={editing ? `Edit ${product.name}` : "New product"}
      subtitle={editing ? product.slug : "Creates the product shell — add variants & prices next."}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !form.name} onClick={save}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create product"}
          </button>
        </>
      }
    >
      <div className="field">
        <label>Name</label>
        <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>

      {/* Images */}
      <div className="field">
        <label>Images {images.length > 0 && <span className="muted">· {images.length}</span>}</label>
        <div className="img-grid">
          {images.map((im) => (
            <div key={im.id} className={`img-cell ${im.is_primary ? "is-primary" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.storage_key} alt={im.alt ?? ""} />
              <button className="img-x" onClick={() => removeImage(im.id)} aria-label="Remove image">✕</button>
              {im.is_primary ? (
                <span className="img-badge">Primary</span>
              ) : (
                <button className="img-setprimary" onClick={() => makePrimary(im.id)}>Set primary</button>
              )}
            </div>
          ))}
          {images.length === 0 && <p className="muted small" style={{ gridColumn: "1/-1", margin: 0 }}>No images yet.</p>}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <input
            className="input grow"
            placeholder="Paste an image URL (https://…)"
            value={imgUrl}
            onChange={(e) => setImgUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImage(); } }}
          />
          <button className="btn btn-outline btn-sm" disabled={imgBusy || !imgUrl.trim()} onClick={addImage}>
            {imgBusy ? "Adding…" : "Add"}
          </button>
        </div>
        <p className="muted small" style={{ margin: "6px 0 0" }}>
          {editing
            ? "Direct file upload needs object storage (R2); paste a hosted image URL for now."
            : "Paste hosted image URLs — they'll be attached when you create the product."}
        </p>
      </div>

      <div className="field">
        <label>Sub-category (optional)</label>
        <input className="input" value={form.sub_category} onChange={(e) => set("sub_category", e.target.value)} />
      </div>
      <div className="row">
        <div className="field grow">
          <label>Category</label>
          <select className="input" value={form.category_slug} onChange={(e) => set("category_slug", e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field grow">
          <label>Schedule</label>
          <select className="input" value={form.schedule} onChange={(e) => set("schedule", e.target.value)}>
            {SCHEDULES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="row">
        <div className="field grow">
          <label>Stock status</label>
          <select className="input" value={form.stock_status} onChange={(e) => set("stock_status", e.target.value)}>
            {STOCK.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ width: 130 }}>
          <label>GST %</label>
          <input className="input" inputMode="numeric" value={form.gst_rate_pct} onChange={(e) => set("gst_rate_pct", e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </div>
      </div>
      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} />
          Featured on the home page
        </label>
      </div>
      <div className="field">
        <label>Description</label>
        <textarea className="input" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>

      <div style={{ borderTop: "1px solid var(--line)", margin: "6px 0 14px" }} />
      <h4 style={{ margin: "0 0 10px" }}>Product information</h4>
      <p className="muted small" style={{ margin: "0 0 14px" }}>
        Shown under the description on the product page.
      </p>

      <div className="field">
        <label>Healthcare data / uses</label>
        <textarea className="input" rows={2} value={form.uses} onChange={(e) => set("uses", e.target.value)} />
      </div>
      <div className="field">
        <label>Materials &amp; composition</label>
        <textarea className="input" rows={2} value={form.composition} onChange={(e) => set("composition", e.target.value)} />
      </div>
      <div className="field">
        <label>How to use / directions</label>
        <textarea className="input" rows={2} value={form.directions} onChange={(e) => set("directions", e.target.value)} />
      </div>
      <div className="field">
        <label>When to take</label>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {DOSE_SLOTS.map((slot) => (
            <label key={slot} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", textTransform: "capitalize" }}>
              <input type="checkbox" checked={dosage.includes(slot)} onChange={() => toggleDose(slot)} />
              {slot}
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Storage</label>
        <input className="input" value={form.storage} onChange={(e) => set("storage", e.target.value)} />
      </div>
      <div className="field">
        <label>Safety warnings</label>
        <textarea className="input" rows={2} value={form.warnings} onChange={(e) => set("warnings", e.target.value)} />
      </div>
      <div className="row">
        <div className="field grow">
          <label>Manufacturer</label>
          <input className="input" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
        </div>
        <div className="field grow">
          <label>Country of origin</label>
          <input className="input" value={form.country_of_origin} onChange={(e) => set("country_of_origin", e.target.value)} />
        </div>
      </div>
      <div className="row">
        <div className="field grow">
          <label>Mfg. date</label>
          <input className="input" placeholder="e.g. Mar 2026" value={form.mfg_date} onChange={(e) => set("mfg_date", e.target.value)} />
        </div>
        <div className="field grow">
          <label>Expiry date</label>
          <input className="input" placeholder="e.g. Apr 2028" value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} />
        </div>
      </div>
    </Drawer>
  );
}

/* ---------- Add variant ---------- */

function VariantForm({
  product,
  onClose,
  onDone,
}: {
  product: AdminProduct;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [packSize, setPackSize] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [isDefault, setIsDefault] = useState(product.variant_count === 0);
  const [mrp, setMrp] = useState("");
  const [selling, setSelling] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      // Customer price seeds all roles; per-role tiers are set in Prices next.
      const price = { role: "customer", mrp: toPaise(mrp), selling_price: toPaise(selling) };
      await api.post(`/admin/products/${product.id}/variants`, {
        pack_size: packSize,
        unit_label: unitLabel,
        is_default: isDefault,
        prices: [price],
      });
      toast("Variant added — set role prices via Prices");
      onDone();
    } catch {
      toast("Could not add the variant", true);
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={`Add variant — ${product.name}`}
      subtitle="Pack size + a customer price to start; role tiers live in Prices."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={busy || !packSize || !unitLabel || toPaise(mrp) <= 0 || toPaise(selling) <= 0}
            onClick={save}
          >
            {busy ? "Adding…" : "Add variant"}
          </button>
        </>
      }
    >
      <div className="row">
        <div className="field grow">
          <label>Pack size</label>
          <input className="input" placeholder="e.g. Strip of 10" value={packSize} onChange={(e) => setPackSize(e.target.value)} />
        </div>
        <div className="field grow">
          <label>Unit label</label>
          <input className="input" placeholder="e.g. 10 tablets" value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} />
        </div>
      </div>
      <div className="row">
        <div className="field grow">
          <label>MRP ₹</label>
          <input className="input" inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} />
        </div>
        <div className="field grow">
          <label>Selling price ₹</label>
          <input className="input" inputMode="decimal" value={selling} onChange={(e) => setSelling(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Default variant (shown first on the storefront)
        </label>
      </div>
    </Drawer>
  );
}

/* ---------- Price editor ----------
   Per variant, per role: MRP, selling anchor, and the optional indicative
   range that flips the product into quote-only. All entry in rupees. */

const ROLES = ["customer", "clinician", "retailer"] as const;
type Role = (typeof ROLES)[number];

interface PriceRowForm {
  mrp: string;
  selling: string;
  rmin: string;
  rmax: string;
}
type VariantForms = Record<Role, PriceRowForm>;

/* Admin detail shape — variants + per-role prices, draft or live. */
interface AdminPriceRow {
  role: string;
  mrp: number;
  selling_price: number;
  range_min: number | null;
  range_max: number | null;
}
interface AdminVariantRow {
  id: string;
  pack_size: string;
  prices: AdminPriceRow[];
}
interface AdminDetail {
  variants: AdminVariantRow[];
}

function PriceEditor({
  product,
  onClose,
  onDone,
  onAddVariant,
}: {
  product: AdminProduct;
  onClose: () => void;
  onDone: () => void;
  onAddVariant: () => void;
}) {
  const toast = useToast();
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [forms, setForms] = useState<Record<string, VariantForms>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Admin detail endpoint — resolves drafts too (the public /products/{slug}
    // route filters to published rows, which left drafts unpriceable).
    api
      .get<AdminDetail>(`/admin/products/${product.id}`)
      .then((d) => {
        setDetail(d);
        const initial: Record<string, VariantForms> = {};
        for (const v of d.variants) {
          const form = {} as VariantForms;
          for (const role of ROLES) {
            const p = (v.prices ?? []).find((x) => x.role === role);
            form[role] = {
              mrp: toRupeeInput(p?.mrp ?? null),
              selling: toRupeeInput(p?.selling_price ?? null),
              rmin: toRupeeInput(p?.range_min ?? null),
              rmax: toRupeeInput(p?.range_max ?? null),
            };
          }
          initial[v.id] = form;
        }
        setForms(initial);
      })
      .catch(() => toast("Could not load prices", true));
  }, [product.id, toast]);

  function setField(vid: string, role: Role, key: keyof PriceRowForm, value: string) {
    setForms((f) => ({ ...f, [vid]: { ...f[vid], [role]: { ...f[vid][role], [key]: value } } }));
  }

  async function save() {
    if (!detail) return;
    setBusy(true);
    try {
      for (const v of detail.variants) {
        const form = forms[v.id];
        const prices = ROLES.filter((r) => form[r].mrp && form[r].selling).map((r) => {
          const hasRange = form[r].rmin.trim() !== "" && form[r].rmax.trim() !== "";
          if (hasRange && toPaise(form[r].rmax) < toPaise(form[r].rmin)) {
            throw new Error(`${v.pack_size} / ${r}: range max is below min`);
          }
          return {
            role: r,
            mrp: toPaise(form[r].mrp),
            selling_price: toPaise(form[r].selling),
            range_min: hasRange ? toPaise(form[r].rmin) : null,
            range_max: hasRange ? toPaise(form[r].rmax) : null,
          };
        });
        await api.patch(`/admin/variants/${v.id}`, { prices });
      }
      toast("Prices updated");
      onDone();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "Could not save prices", true);
      setBusy(false);
    }
  }

  return (
    <Drawer
      wide
      title="Prices"
      subtitle={`${product.name} — leave the range empty for a fixed price; fill it to make the product quote-only.`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !detail || detail.variants.length === 0}
            onClick={save}
          >
            {busy ? "Saving…" : "Save prices"}
          </button>
        </>
      }
    >
      {!detail ? (
        <div className="muted small">Loading current prices…</div>
      ) : detail.variants.length === 0 ? (
        /* Prices hang off variants, so a product with no pack size has
           nothing to price — send the user to add one first. */
        <div className="empty" style={{ display: "grid", gap: 10, justifyItems: "start" }}>
          <h4 style={{ margin: 0 }}>No pack sizes yet</h4>
          <p className="muted small" style={{ margin: 0, maxWidth: 460 }}>
            Prices are set per pack size (variant), and this product doesn&apos;t have one
            yet. Add a pack size — with its customer price — and the per-role tiers will
            appear here.
          </p>
          <button className="btn btn-primary" onClick={onAddVariant}>
            Add pack size
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {detail.variants.map((v) => (
            <section key={v.id}>
              <h4 style={{ margin: "0 0 10px" }}>{v.pack_size}</h4>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>MRP ₹</th>
                    <th>Selling ₹</th>
                    <th>Range min ₹</th>
                    <th>Range max ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((role) => (
                    <tr key={role}>
                      <td style={{ textTransform: "capitalize", fontWeight: 600 }}>{role}</td>
                      {(["mrp", "selling", "rmin", "rmax"] as const).map((key) => (
                        <td key={key}>
                          <input
                            className="input"
                            style={{ minWidth: 84 }}
                            inputMode="decimal"
                            value={forms[v.id]?.[role]?.[key] ?? ""}
                            placeholder={key === "rmin" || key === "rmax" ? "—" : ""}
                            onChange={(e) => setField(v.id, role, key, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </Drawer>
  );
}

/** Single product: gallery, compliance facts, per-role variant pricing.
    Live products load the public detail; drafts fall back to admin row data. */
function ProductViewDrawer({
  product,
  onClose,
  onEdit,
  onPrices,
  onToggle,
}: {
  product: AdminProduct;
  onClose: () => void;
  onEdit: () => void;
  onPrices: () => void;
  onToggle: () => void;
}) {
  const detail = useApi<ProductDetail>(product.is_active ? `/products/${product.slug}` : null);
  const d = detail.data;
  const attrs = Object.entries(product.attributes ?? {}).filter(([, v]) => v != null && v !== "");

  return (
    <Drawer
      wide
      title={product.name}
      subtitle={`${product.category_name}${product.sub_category ? ` · ${product.sub_category}` : ""}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-outline" onClick={onToggle}>
            {product.is_active ? "Unpublish" : "Publish"}
          </button>
          <button className="btn btn-outline" onClick={onPrices}>Prices</button>
          <button className="btn btn-primary" onClick={onEdit}>Edit</button>
        </>
      }
    >
      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span className={`pill ${product.is_active ? "pill-ok" : "pill-muted"}`}>{product.is_active ? "Live" : "Draft"}</span>
        <span className={`pill ${statusPill(product.stock_status)}`}>{product.stock_status.replace(/_/g, " ")}</span>
        {product.schedule !== "NONE" && <span className="pill pill-rx">Rx · Schedule {product.schedule}</span>}
        {product.is_featured && <span className="pill pill-info">Featured</span>}
      </div>

      {product.images.length > 0 && (
        <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {product.images.map((img) => (
            <span key={img.id} className="prod-thumb" style={{ width: 72, height: 72 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.storage_key} alt={img.alt ?? ""} />
            </span>
          ))}
        </div>
      )}

      <dl className="drawer-dl">
        <dt>Slug</dt>
        <dd className="mono">{product.slug}</dd>
        <dt>Category</dt>
        <dd>{product.category_name}{product.sub_category ? ` · ${product.sub_category}` : ""}</dd>
        <dt>GST rate</dt>
        <dd className="mono">{product.gst_rate_pct}%</dd>
        <dt>Variants</dt>
        <dd className="mono">{product.variant_count}</dd>
      </dl>

      {product.description && (
        <>
          <h4 className="drawer-h">Description</h4>
          <p className="small" style={{ margin: 0 }}>{product.description}</p>
        </>
      )}

      {attrs.length > 0 && (
        <>
          <h4 className="drawer-h">Attributes</h4>
          <dl className="drawer-dl">
            {attrs.map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <h4 className="drawer-h">Variants &amp; pricing</h4>
      {!product.is_active && (
        <p className="muted small">Draft product — publish it to see live tier pricing here, or open Prices to manage it.</p>
      )}
      {product.is_active && detail.loading && <p className="muted small">Loading pricing…</p>}
      {product.is_active && !detail.loading && !d && (
        <p className="muted small">Could not load live pricing — open Prices to manage it.</p>
      )}
      {d && (
        <table className="tbl">
          <thead>
            <tr>
              <th>Pack</th>
              <th className="num">Customer</th>
              <th className="num">Clinician</th>
              <th className="num">Retailer</th>
            </tr>
          </thead>
          <tbody>
            {d.variants.map((v) => {
              const by = (role: string) => v.prices.find((pr) => pr.role === role);
              const fmt = (pr?: { selling_price: number; range_min?: number | null; range_max?: number | null }) =>
                !pr ? "—" : pr.range_min != null && pr.range_max != null
                  ? `${inr(pr.range_min)}–${inr(pr.range_max)}`
                  : inr(pr.selling_price);
              return (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>
                    {v.pack_size}
                    {v.is_default && <span className="mini-tag t-sub" style={{ marginLeft: 6 }}>default</span>}
                  </td>
                  <td className="num mono">{fmt(by("customer"))}</td>
                  <td className="num mono">{fmt(by("clinician"))}</td>
                  <td className="num mono">{fmt(by("retailer"))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Drawer>
  );
}
