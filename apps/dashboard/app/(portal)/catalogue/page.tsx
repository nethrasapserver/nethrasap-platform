"use client";

import type { ProductListItem } from "@nethrasap/api-client";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { inr, statusPill } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

interface Category {
  id: string;
  slug: string;
  name: string;
}

export default function CataloguePage() {
  const { data, loading, refetch } = useApi<{ items: ProductListItem[]; total: number }>("/products", { limit: 100 });
  const cats = useApi<{ items: Category[] }>("/categories", { limit: 50 });
  const [create, setCreate] = useState(false);

  return (
    <div>
      <div className="page-head">
        <h1>Catalogue</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setCreate(true)}>
          + New product
        </button>
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Product</th>
              <th>Brand</th>
              <th>Category</th>
              <th>Stock</th>
              <th className="num">Price</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="empty">
                  Loading…
                </td>
              </tr>
            )}
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td className="muted">{p.brand}</td>
                <td className="muted">{p.category_name}</td>
                <td>
                  <span className={`pill ${statusPill(p.stock_status)}`}>{p.stock_status.replace(/_/g, " ")}</span>
                </td>
                <td className="num">{inr(p.price_min)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {create && (
        <CreateProduct
          categories={cats.data?.items ?? []}
          onClose={() => setCreate(false)}
          onDone={() => {
            setCreate(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function CreateProduct({
  categories,
  onClose,
  onDone,
}: {
  categories: Category[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "");
  const [schedule, setSchedule] = useState("NONE");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="New product" onClose={onClose}>
      <div className="field">
        <label>Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Brand</label>
        <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
      </div>
      <div className="row">
        <div className="field grow">
          <label>Category</label>
          <select className="input" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field grow">
          <label>Schedule</label>
          <select className="input" value={schedule} onChange={(e) => setSchedule(e.target.value)}>
            <option>NONE</option>
            <option>H</option>
            <option>H1</option>
            <option>X</option>
          </select>
        </div>
      </div>
      <button
        className="btn btn-primary"
        disabled={busy || !name || !brand}
        onClick={async () => {
          setBusy(true);
          try {
            await api.post("/admin/products", { name, brand, category_slug: categorySlug, schedule });
            toast("Product created — add variants & prices next");
            onDone();
          } catch {
            toast("Create failed", true);
            setBusy(false);
          }
        }}
      >
        Create product
      </button>
    </Modal>
  );
}
