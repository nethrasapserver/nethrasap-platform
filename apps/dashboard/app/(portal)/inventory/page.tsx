"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/Drawer";
import { Pagination, paginate } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

interface Level {
  level_id: string;
  variant_id: string;
  product_id: string;
  product_name: string;
  pack_size: string;
  on_hand: number;
  reserved: number;
  available: number;
  reorder_point: number;
  is_low: boolean;
}

export default function InventoryPage() {
  // low_only is a required param upstream; stock states filter client-side.
  const { data, loading, refetch } = useApi<Level[]>("/admin/inventory", { low_only: false });
  const [receive, setReceive] = useState<Level | null>(null);
  const [query, setQuery] = useState("");
  const [stock, setStock] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => setPage(1), [query, stock]);
  const all = data ?? [];
  const rows = all.filter((l) => {
    if (stock === "low" && !l.is_low) return false;
    if (stock === "out" && l.available > 0) return false;
    if (stock === "healthy" && l.is_low) return false;
    if (query && !l.product_name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const pageItems = paginate(rows, page, pageSize);

  return (
    <div>
      <div className="page-head">
        <h1>Inventory</h1>
      </div>

      <div className="card pad filterbar">
        <input
          className="input fsearch"
          placeholder="Search product…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search inventory"
        />
        <Select
          value={stock}
          onChange={setStock}
          options={[
            { value: "low", label: "Low stock" },
            { value: "out", label: "Out of stock" },
            { value: "healthy", label: "Healthy" },
          ]}
          placeholder="All stock"
          ariaLabel="Stock state"
          width={160}
        />
        {(query || stock) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQuery(""); setStock(""); }}>
            Clear
          </button>
        )}
        <span className="muted small fcount">{rows.length} of {all.length}</span>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Product</th>
              <th>Pack</th>
              <th className="num">On hand</th>
              <th className="num">Reserved</th>
              <th className="num">Available</th>
              <th className="num">Reorder</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="empty">
                  Loading…
                </td>
              </tr>
            )}
            {pageItems.map((l) => (
              <tr key={l.level_id}>
                <td style={{ fontWeight: 600 }}>{l.product_name}</td>
                <td className="muted">{l.pack_size}</td>
                <td className="num">{l.on_hand}</td>
                <td className="num muted">{l.reserved}</td>
                <td className="num">
                  <span className={`pill ${l.is_low ? "pill-warn" : "pill-ok"}`}>{l.available}</span>
                </td>
                <td className="num muted">{l.reorder_point}</td>
                <td className="num">
                  <button className="btn btn-outline btn-sm" onClick={() => setReceive(l)}>
                    Receive
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  {query || stock ? "Nothing matches these filters." : "No tracked stock."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={rows.length} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />

      {receive && (
        <ReceiveModal
          level={receive}
          onClose={() => setReceive(null)}
          onDone={() => {
            setReceive(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function ReceiveModal({ level, onClose, onDone }: { level: Level; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState("100");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Drawer
      title="Receive stock"
      subtitle={level.product_name}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !qty}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post("/admin/inventory/receive", {
                  variant_id: level.variant_id,
                  quantity: Number(qty),
                });
                toast("Stock received");
                onDone();
              } catch {
                toast("Could not receive stock", true);
                setBusy(false);
              }
            }}
          >
            {busy ? "Adding…" : "Add to inventory"}
          </button>
        </>
      }
    >
      <dl className="drawer-dl" style={{ marginBottom: 18 }}>
        <dt>Pack size</dt>
        <dd>{level.pack_size}</dd>
        <dt>Currently on hand</dt>
        <dd className="mono">{level.on_hand}</dd>
      </dl>
      <div className="field">
        <label>Quantity received</label>
        <input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        New on-hand total <strong className="mono">{level.on_hand + (Number(qty) || 0)}</strong> — posts a
        receipt line to the stock ledger.
      </p>
    </Drawer>
  );
}
