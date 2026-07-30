"use client";

import type { Schemas } from "@nethrasap/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

/* Ratings & reviews per the approved mockup: bordered white review cards with
   stars, author and a verified-purchase chip. The first page is fetched
   server-side in page.tsx and passed down, so reviews render without a
   client round-trip; posting refreshes the route to re-run that fetch. */

type Review = Schemas["ReviewOut"];
type ReviewPage = Schemas["Paginated_ReviewOut_"];

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

function WriteReview({ slug }: { slug: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");

  if (!user) {
    return (
      <Link href={`/login?next=/products/${slug}`} className="btn btn-outline" style={{ marginTop: 14 }}>
        Write a review
      </Link>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-outline" onClick={() => setOpen(true)} style={{ marginTop: 14 }}>
        Write a review
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/products/${slug}/reviews`, { rating, title: null, body: body || null });
      toast("Thanks — your review is posted");
      setOpen(false);
      setBody("");
      // Reviews are fetched server-side; refresh re-runs that fetch.
      router.refresh();
    } catch {
      toast("Could not post your review", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card pad rev-form" onSubmit={submit}>
      <div className="field">
        <label>Your rating</label>
        <div className="rev-picker">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`}
              className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={n <= rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
                <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z" />
              </svg>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="rev-body">Your review (optional)</label>
        <textarea id="rev-body" className="input" rows={4} maxLength={4000} value={body}
          onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="row" style={{ gap: 10 }}>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Posting…" : "Post review"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function ReviewsSection({
  slug,
  rating,
  count,
  initial,
}: {
  slug: string;
  rating: number;
  count: number;
  initial: ReviewPage | null;
}) {
  const items: Review[] = initial?.items ?? [];
  const total = initial?.total ?? count;

  return (
    <section className="pdp-section" id="reviews">
      <h2>
        Ratings &amp; reviews{" "}
        {total > 0 && (
          <span className="muted" style={{ fontWeight: 500, fontSize: ".9rem" }}>
            — {rating.toFixed(1)} ★ from {total} buyer{total === 1 ? "" : "s"}
          </span>
        )}
      </h2>

      {items.length === 0 && (
        <p className="muted small">No reviews yet — be the first to share your experience.</p>
      )}

      {items.map((r) => (
        <article key={r.id} className="review-card">
          <div className="who">
            {r.author.full_name}
            {r.is_verified_purchase && <span className="vp">✓ Verified purchase</span>}
          </div>
          <Stars value={r.rating} />
          {r.title && <p style={{ fontWeight: 700 }}>{r.title}</p>}
          {r.body && <p>{r.body}</p>}
          <span className="small muted">{new Date(r.created_at).toLocaleDateString("en-IN")}</span>
        </article>
      ))}

      <WriteReview slug={slug} />
    </section>
  );
}
