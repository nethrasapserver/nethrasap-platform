"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/format";

export default function CartPage() {
  const { cart, update, remove } = useCart();
  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="container section">
        <h2>Your cart</h2>
        <div className="card pad muted" style={{ marginTop: 16 }}>
          Your cart is empty. <Link href="/products">Browse products →</Link>
        </div>
      </div>
    );
  }

  const t = cart!.totals;
  return (
    <div className="container section">
      <h2>Your cart</h2>
      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", alignItems: "start", marginTop: 16 }}>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th style={{ textAlign: "right" }}>Line</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{it.product?.name}</div>
                    <div className="muted small">
                      {it.product?.brand} · {inr(it.unit_price)} each
                    </div>
                  </td>
                  <td>
                    <div className="row" style={{ border: "1px solid var(--line)", borderRadius: 8, width: "fit-content" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => update(it.id, Math.max(1, it.quantity - 1))}>
                        −
                      </button>
                      <span style={{ minWidth: 24, textAlign: "center" }}>{it.quantity}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => update(it.id, it.quantity + 1)}>
                        +
                      </button>
                    </div>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{inr(it.line_subtotal)}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(it.id)} aria-label="Remove">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card pad" style={{ display: "grid", gap: 10 }}>
          <h3>Summary</h3>
          <Row label="Subtotal" value={inr(t.subtotal)} />
          {t.discount > 0 && <Row label="Discount" value={`− ${inr(t.discount)}`} />}
          <Row label="GST" value={inr(t.gst)} />
          <Row label="Shipping" value={t.shipping === 0 ? "Free" : inr(t.shipping)} />
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            <Row label={<strong>Total</strong>} value={<strong>{inr(t.grand_total)}</strong>} />
          </div>
          <Link href="/checkout" className="btn btn-primary btn-block">
            Proceed to checkout
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="row spread">
      <span className="muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
