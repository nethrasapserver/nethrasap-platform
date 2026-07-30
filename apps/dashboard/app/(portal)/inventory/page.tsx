"use client";

import type { Schemas } from "@nethrasap/api-client";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/Drawer";
import { KPI_ICONS, KpiRow } from "@/components/Kpi";
import { Pagination, paginate } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { useApi } from "@/lib/useApi";

type Level = Schemas["StockLevelOut"];

export default function InventoryPage() {
  // low_only is a required param upstream; stock states filter client-side.
  const { data, loading, refetch } = useApi<Level[]>("/admin/inventory", { low_only: false });
  const [receive, setReceive] = useState<Level | null>(null);
  const [view, setView] = useState<Level | null>(null);
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

      <KpiRow
        items={[
          { label: "Tracked SKUs", value: all.length, sub: "variants with stock records", icon: KPI_ICONS.box, tone: "brand" },
          { label: "Units on hand", value: all.reduce((n, l) => n + l.on_hand, 0).toLocaleString("en-IN"), sub: "across the warehouse", icon: KPI_ICONS.tag, tone: "info" },
          { label: "Low stock", value: all.filter((l) => l.is_low).length, sub: "below reorder point", icon: KPI_ICONS.warn, tone: "clay", onClick: () => setStock("low"), active: stock === "low" },
          { label: "Out of stock", value: all.filter((l) => l.available <= 0).length, sub: "unavailable to sell", icon: KPI_ICONS.warn, tone: "danger", onClick: () => setStock("out"), active: stock === "out" },
        ]}
      />

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
              <tr
                key={l.level_id}
                onClick={() => setView(l)}
                onKeyDown={(e) => e.key === "Enter" && setView(l)}
                tabIndex={0}
                style={{ cursor: "pointer" }}
              >
                <td style={{ fontWeight: 600 }}>{l.product_name}</td>
                <td className="muted">{l.pack_size}</td>
                <td className="num">{l.on_hand}</td>
                <td className="num muted">{l.reserved}</td>
                <td className="num">
                  <span className={`pill ${l.is_low ? "pill-warn" : "pill-ok"}`}>{l.available}</span>
                </td>
                <td className="num muted">{l.reorder_point}</td>
                <td className="num" onClick={(e) => e.stopPropagation()}>
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

      {view && (
        <LevelDrawer
          level={view}
          onClose={() => setView(null)}
          onReceive={() => {
            setReceive(view);
            setView(null);
          }}
        />
      )}

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

interface LedgerEntry {
  id: string;
  movement: string;
  quantity: number;
  reason: string | null;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  created_at: string;
}

/** Single stock item: level detail + the append-only movement ledger. */
function LevelDrawer({ level, onClose, onReceive }: { level: Level; onClose: () => void; onReceive: () => void }) {
  const ledger = useApi<LedgerEntry[]>("/admin/inventory/ledger", { variant_id: level.variant_id, limit: 25 });

  return (
    <Drawer
      wide
      title={level.product_name}
      subtitle={`${level.pack_size} · stock detail`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={onReceive}>Receive stock</button>
        </>
      }
    >
      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span className={`pill ${level.available <= 0 ? "pill-out" : level.is_low ? "pill-low" : "pill-ok"}`}>
          {level.available <= 0 ? "out of stock" : level.is_low ? "low stock" : "healthy"}
        </span>
      </div>

      <dl className="drawer-dl">
        <dt>On hand</dt>
        <dd className="mono">{level.on_hand}</dd>
        <dt>Reserved</dt>
        <dd className="mono">{level.reserved}</dd>
        <dt>Available to sell</dt>
        <dd className="mono" style={{ fontWeight: 700 }}>{level.available}</dd>
        <dt>Reorder point</dt>
        <dd className="mono">{level.reorder_point}</dd>
      </dl>

      <h4 className="drawer-h">Recent movements</h4>
      {ledger.loading && <p className="muted small">Loading ledger…</p>}
      {!ledger.loading && (ledger.data ?? []).length === 0 && (
        <p className="muted small">No ledger entries yet.</p>
      )}
      {(ledger.data ?? []).length > 0 && (
        <table className="tbl">
          <thead>
            <tr>
              <th>When</th>
              <th>Movement</th>
              <th className="num">Qty</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {(ledger.data ?? []).map((e) => (
              <tr key={e.id}>
                <td className="muted small">{dateTime(e.created_at)}</td>
                <td>
                  <span className={`pill ${e.quantity >= 0 ? "pill-ok" : "pill-low"}`}>{e.movement.replace(/_/g, " ")}</span>
                  {e.reason && <div className="muted small">{e.reason}</div>}
                </td>
                <td className="num mono" style={{ fontWeight: 600 }}>{e.quantity > 0 ? `+${e.quantity}` : e.quantity}</td>
                <td className="muted small mono">
                  {e.ref_type ? `${e.ref_type} ${String(e.ref_id ?? "").slice(0, 8)}` : e.note ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Drawer>
  );
}
