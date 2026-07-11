"use client";

import type { OrderListItem } from "@nethrasap/api-client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_CLS: Record<string, string> = {
  delivered: "pill-ok",
  confirmed: "pill-ok",
  dispatched: "pill-rx",
  out_for_delivery: "pill-rx",
  placed: "pill-low",
  cancelled: "pill-out",
  payment_failed: "pill-out",
};

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="container section muted">Loading…</div>}>
      <AccountInner />
    </Suspense>
  );
}

function AccountInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [orders, setOrders] = useState<OrderListItem[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user)
      api
        .get<{ items: OrderListItem[] }>("/orders")
        .then((d) => setOrders(d.items))
        .catch(() => setOrders([]));
  }, [user]);

  if (!user) return null;
  const needsKyc = user.status === "pending_kyc";

  return (
    <div className="container section">
      <div className="row spread">
        <h2>Hello, {user.profile?.full_name ?? "there"}</h2>
        <span className={`pill ${user.status === "active" ? "pill-ok" : "pill-low"}`}>{user.status}</span>
      </div>

      {needsKyc && (
        <div className="card pad" style={{ marginTop: 16, borderColor: "var(--amber)" }}>
          <strong>Verify your account to unlock {user.role} pricing.</strong>
          <p className="muted small" style={{ margin: "6px 0 10px" }}>
            Upload your {user.role === "retailer" ? "drug licence (20B/21B) and GSTIN" : "council registration"} to
            get verified.
          </p>
          {params.get("kyc") && <span className="pill pill-low">KYC upload coming next in this build</span>}
        </div>
      )}

      <h3 style={{ marginTop: 28 }}>Your orders</h3>
      {orders.length === 0 ? (
        <div className="card pad muted">
          No orders yet. <Link href="/products">Start shopping →</Link>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 8 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Placed</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_number}>
                  <td>
                    <Link href={`/orders/${o.order_number}`} style={{ fontWeight: 600, color: "var(--brand-dark)" }}>
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="muted small">{new Date(o.placed_at).toLocaleDateString("en-IN")}</td>
                  <td>
                    <span className={`pill ${STATUS_CLS[o.status] ?? "pill-rx"}`}>{o.status.replace(/_/g, " ")}</span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{inr(o.grand_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
