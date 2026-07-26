"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Category {
  id: string;
  slug: string;
  name: string;
  product_count: number;
}
interface Facets {
  price_min: number;
  price_max: number;
}

const SORTS: { value: string; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "popular", label: "Most popular" },
];

const rupees = (paise: number) => Math.round(paise / 100);

export function ProductFilters({
  categories,
  facets,
  children,
}: {
  categories: Category[];
  facets: Facets;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false); // mobile drawer

  // Local price inputs (rupees) so typing doesn't refetch on every keystroke.
  const [minR, setMinR] = useState("");
  const [maxR, setMaxR] = useState("");
  useEffect(() => {
    setMinR(params.get("price_min") ? String(rupees(Number(params.get("price_min")))) : "");
    setMaxR(params.get("price_max") ? String(rupees(Number(params.get("price_max")))) : "");
  }, [params]);

  const category = params.get("category") ?? "";
  const prescription = params.get("prescription"); // "true" | "false" | null
  const inStock = params.get("in_stock") === "true";
  const sort = params.get("sort") ?? "relevance";
  const activeCount =
    (category ? 1 : 0) + (prescription ? 1 : 0) + (inStock ? 1 : 0) +
    (params.get("price_min") || params.get("price_max") ? 1 : 0);

  function apply(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    // Keep the free-text query; drop pagination on any filter change.
    sp.delete("offset");
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  const applyPrice = () => {
    apply({
      price_min: minR.trim() ? String(Number(minR) * 100) : null,
      price_max: maxR.trim() ? String(Number(maxR) * 100) : null,
    });
  };

  const clearAll = () => {
    const sp = new URLSearchParams();
    const q = params.get("q");
    if (q) sp.set("q", q);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const body = (
    <>
      <div className="filt-head">
        <span>Filters{activeCount > 0 ? ` · ${activeCount}` : ""}</span>
        {activeCount > 0 && (
          <button className="filt-clear" onClick={clearAll}>Clear all</button>
        )}
      </div>

      {/* Categories */}
      <div className="filt-group">
        <h4>Category</h4>
        <button className={`filt-opt ${!category ? "is-on" : ""}`} onClick={() => apply({ category: null })}>
          All categories
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`filt-opt ${category === c.slug ? "is-on" : ""}`}
            onClick={() => apply({ category: category === c.slug ? null : c.slug })}
          >
            <span>{c.name}</span>
            <span className="filt-count">{c.product_count}</span>
          </button>
        ))}
      </div>

      {/* Price */}
      <div className="filt-group">
        <h4>Price (₹)</h4>
        <div className="filt-price">
          <input className="input" inputMode="numeric" placeholder={String(rupees(facets.price_min))} value={minR} onChange={(e) => setMinR(e.target.value.replace(/\D/g, ""))} />
          <span className="muted">to</span>
          <input className="input" inputMode="numeric" placeholder={String(rupees(facets.price_max))} value={maxR} onChange={(e) => setMaxR(e.target.value.replace(/\D/g, ""))} />
          <button className="btn btn-outline btn-sm" onClick={applyPrice}>Go</button>
        </div>
      </div>

      {/* Type */}
      <div className="filt-group">
        <h4>Type</h4>
        <label className="filt-check">
          <input type="radio" name="rx" checked={!prescription} onChange={() => apply({ prescription: null })} /> All
        </label>
        <label className="filt-check">
          <input type="radio" name="rx" checked={prescription === "true"} onChange={() => apply({ prescription: "true" })} /> Prescription (Rx)
        </label>
        <label className="filt-check">
          <input type="radio" name="rx" checked={prescription === "false"} onChange={() => apply({ prescription: "false" })} /> Over the counter
        </label>
      </div>

      {/* Availability */}
      <div className="filt-group">
        <h4>Availability</h4>
        <label className="filt-check">
          <input type="checkbox" checked={inStock} onChange={(e) => apply({ in_stock: e.target.checked ? "true" : null })} /> In stock only
        </label>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle + sort */}
      <div className="filt-bar">
        <button className="btn btn-outline btn-sm filt-toggle" onClick={() => setOpen(true)}>
          Filters{activeCount > 0 ? ` · ${activeCount}` : ""}
        </button>
        <label className="filt-sort">
          <span className="muted small">Sort</span>
          <select className="input" value={sort} onChange={(e) => apply({ sort: e.target.value === "relevance" ? null : e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="filt-layout">
        <aside className="filt-panel">{body}</aside>
        <div className="filt-main">{children}</div>
      </div>

      {open && (
        <div className="filt-drawer-scrim" onClick={() => setOpen(false)}>
          <div className="filt-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="filt-drawer-top">
              <b>Filters</b>
              <button className="filt-clear" onClick={() => setOpen(false)}>Done</button>
            </div>
            {body}
          </div>
        </div>
      )}
    </>
  );
}
