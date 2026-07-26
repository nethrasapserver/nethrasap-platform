"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/Drawer";
import { Pagination, paginate } from "@/components/Pagination";
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
  const [lowOnly, setLowOnly] = useState(false);
  const { data, loading, refetch } = useApi<Level[]>("/admin/inventory", { low_only: lowOnly });
  const [receive, setReceive] = useState<Level | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  useEffect(() => setPage(1), [lowOnly]);
  const rows = data ?? [];
  const pageItems = paginate(rows, page, PAGE_SIZE);

  return (
    <div>
      <div className="page-head">
        <h1>Inventory</h1>
        <label className="row small" style={{ gap: 6 }}>
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only
        </label>
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
                  No tracked stock.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} />

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
