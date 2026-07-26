"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

interface ReviewAuthor { id: string; full_name: string; role: string }
interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_verified_purchase: boolean;
  created_at: string;
  author: ReviewAuthor;
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
          fill={i <= Math.round(value) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z" />
        </svg>
      ))}
    </span>
  );
}

export function ProductReviews({ slug, rating, count }: { slug: string; rating: number; count: number }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Review[] | null>(null);
  const [total, setTotal] = useState(count);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ rating: 5, title: "", body: "" });

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ items: Review[]; total: number }>(`/products/${slug}/reviews`, { limit: 20 });
      setItems(r.items);
      setTotal(r.total);
    } catch {
      setItems([]);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/products/${slug}/reviews`, {
        rating: form.rating,
        title: form.title || null,
        body: form.body || null,
      });
      toast("Thanks — your review is posted");
      setOpen(false);
      setForm({ rating: 5, title: "", body: "" });
      await load();
    } catch {
      toast("Could not post your review", true);
    } finally {
      setBusy(false);
    }
  }

  // Distribution from the loaded page — enough to shape the bars.
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: (items ?? []).filter((r) => r.rating === star).length,
  }));
  const maxN = Math.max(1, ...dist.map((d) => d.n));

  return (
    <section className="pdp-section" id="reviews">
      <h2>Reviews {total > 0 && <span className="muted">({total})</span>}</h2>

      {total > 0 ? (
        <div className="rev-summary">
          <div className="rev-score">
            <b>{rating.toFixed(1)}</b>
            <Stars value={rating} size={16} />
            <span className="muted small">{total} review{total === 1 ? "" : "s"}</span>
          </div>
          <div className="rev-bars">
            {dist.map((d) => (
              <div key={d.star} className="rev-bar-row">
                <span className="mono small">{d.star}★</span>
                <span className="rev-track"><span className="rev-fill" style={{ width: `${(d.n / maxN) * 100}%` }} /></span>
                <span className="mono small muted">{d.n}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="muted small">No reviews yet — be the first to share your experience.</p>
      )}

      {user ? (
        open ? (
          <form className="card pad rev-form" onSubmit={submit}>
            <div className="field">
              <label>Your rating</label>
              <div className="rev-picker">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className={n <= form.rating ? "on" : ""} onClick={() => setForm({ ...form, rating: n })}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill={n <= form.rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
                      <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="rev-title">Headline (optional)</label>
              <input id="rev-title" className="input" maxLength={120} value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="rev-body">Your review (optional)</label>
              <textarea id="rev-body" className="input" rows={4} maxLength={4000} value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Posting…" : "Post review"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <button className="btn btn-outline" onClick={() => setOpen(true)} style={{ marginTop: 14 }}>
            Write a review
          </button>
        )
      ) : (
        <p className="small muted" style={{ marginTop: 12 }}>
          <Link href="/login">Sign in</Link> to write a review.
        </p>
      )}

      {items === null ? (
        <div className="skeleton" style={{ height: 80, marginTop: 18 }} />
      ) : (
        <div className="rev-list">
          {items.map((r) => (
            <article key={r.id} className="rev-item">
              <div className="row spread">
                <div className="row" style={{ gap: 10 }}>
                  <Stars value={r.rating} />
                  {r.title && <b>{r.title}</b>}
                </div>
                {r.is_verified_purchase && <span className="pill pill-ok">Verified purchase</span>}
              </div>
              {r.body && <p>{r.body}</p>}
              <span className="small muted">
                {r.author.full_name} · {new Date(r.created_at).toLocaleDateString("en-IN")}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
