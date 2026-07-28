"use client";

import { Donut } from "@/components/Charts";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/useApi";

interface AdminProduct {
  id: string;
  category_name: string;
  schedule: string;
  stock_status: string;
  is_active: boolean;
  is_featured: boolean;
}
interface AdminCategory {
  id: string;
  name: string;
  product_count: number;
  is_active: boolean;
}
interface Level {
  level_id: string;
  on_hand: number;
  reserved: number;
  available: number;
  is_low: boolean;
}
interface TopProduct {
  product_name: string;
  units: number;
  revenue_paise: number;
}

/** Catalogue & stock — what's on the shelf and how healthy it is. */
export default function CatalogueAnalytics() {
  const { can } = useAuth();
  const canStock = can("inventory:write");
  const products = useApi<AdminProduct[]>("/admin/products");
  const categories = useApi<AdminCategory[]>("/admin/categories");
  const inventory = useApi<Level[]>(canStock ? "/admin/inventory" : null, { low_only: false });
  const top = useApi<{ items: TopProduct[] }>("/analytics/top-products", { days: 90, limit: 6 });

  const all = products.data ?? [];
  const cats = categories.data ?? [];
  const levels = inventory.data ?? [];
  const live = all.filter((p) => p.is_active).length;
  const rx = all.filter((p) => p.schedule !== "NONE").length;

  return (
    <div className="bento" style={{ marginTop: 4 }}>
      <div className="tile">
        <h3>Products</h3>
        <div className="big">{products.loading ? "…" : all.length}</div>
        <span className="muted small">{live} live · {all.length - live} draft</span>
      </div>
      <div className="tile">
        <h3>Categories</h3>
        <div className="big">{categories.loading ? "…" : cats.length}</div>
        <span className="muted small">{cats.filter((c) => c.is_active).length} live on the storefront</span>
      </div>
      <div className="tile">
        <h3>Prescription items</h3>
        <div className="big">{products.loading ? "…" : rx}</div>
        <span className="muted small">Schedule H / H1 / X</span>
      </div>
      <div className="tile">
        <h3>Units on hand</h3>
        <div className="big">
          {canStock ? (inventory.loading ? "…" : levels.reduce((n, l) => n + l.on_hand, 0).toLocaleString("en-IN")) : "—"}
        </div>
        <span className="muted small">{canStock ? `${levels.length} tracked SKUs` : "needs inventory access"}</span>
      </div>

      <div className="tile b2">
        <h3>Products by category</h3>
        <Donut
          parts={cats.map((c) => ({ label: c.name, value: c.product_count })).sort((a, b) => b.value - a.value).slice(0, 8)}
          centerLabel="products"
        />
      </div>
      <div className="tile b2">
        <h3>Catalogue mix</h3>
        <Donut
          size={150}
          centerLabel="visibility"
          parts={[
            { label: "Live", value: live, color: "#606c38" },
            { label: "Draft", value: all.length - live, color: "#dda15e" },
          ]}
        />
        <Donut
          size={150}
          centerLabel="regulation"
          parts={[
            { label: "OTC", value: all.length - rx, color: "#2b6b7f" },
            { label: "Rx (scheduled)", value: rx, color: "#bc6c25" },
          ]}
        />
      </div>

      {canStock && (
        <div className="tile b2">
          <h3>Stock health</h3>
          <Donut
            centerLabel="SKUs"
            parts={[
              { label: "Healthy", value: levels.filter((l) => !l.is_low && l.available > 0).length, color: "#606c38" },
              { label: "Low", value: levels.filter((l) => l.is_low && l.available > 0).length, color: "#dda15e" },
              { label: "Out", value: levels.filter((l) => l.available <= 0).length, color: "#b94824" },
            ]}
          />
          <p className="muted small" style={{ margin: 0 }}>
            {levels.reduce((n, l) => n + l.reserved, 0)} units reserved against open orders.
          </p>
        </div>
      )}
      <div className="tile b2">
        <h3>
          Top sellers <span className="eyebrow">units · 90 days</span>
        </h3>
        <Donut
          parts={(top.data?.items ?? []).map((t) => ({ label: t.product_name, value: t.units }))}
          format={(n) => `${n}`}
          centerLabel="units"
        />
      </div>
    </div>
  );
}
