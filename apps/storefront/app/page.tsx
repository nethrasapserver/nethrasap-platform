import type { CategoryItem, ProductListItem } from "@nethrasap/api-client";
import Link from "next/link";
import { CategoryRail } from "@/components/CategoryRail";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ProductCard } from "@/components/ProductCard";
import { serverApi } from "@/lib/api";

export const dynamic = "force-dynamic"; // always fresh catalogue

const SHELF_SIZE = 10; // two complete rows of five

async function getData() {
  const api = serverApi();
  const [featured, popular, categories] = await Promise.all([
    api.get<{ items: ProductListItem[] }>("/products", { featured: true, limit: SHELF_SIZE }),
    api.get<{ items: ProductListItem[]; total: number }>("/products", { sort: "popular", limit: SHELF_SIZE }),
    api.get<{ items: CategoryItem[] }>("/categories", { limit: 50 }),
  ]);

  // Featured first, then popular products to fill the shelf — so the grid never
  // renders a ragged half-row while the featured flag is still being curated.
  const seen = new Set(featured.items.map((p) => p.id));
  const shelf = [...featured.items, ...popular.items.filter((p) => !seen.has(p.id))].slice(0, SHELF_SIZE);

  return { shelf, categories: categories.items, catalogueSize: popular.total };
}

const BUYERS = [
  {
    title: "Retail pharmacies",
    body: "Drug licence (20B/21B) + GSTIN verified once. Wholesale slabs, credit-friendly COD, batch-level invoices.",
    href: "/signup",
    d: "M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2",
  },
  {
    title: "Clinicians & hospitals",
    body: "Council registration verified. Clinician pricing, Schedule H/H1 handling, cold-chain biologics.",
    href: "/signup",
    d: "M12 3v18M3 12h18",
  },
  {
    title: "Home & self care",
    body: "OTC essentials, devices and wellness delivered without a prescription, at transparent MRP.",
    href: "/products?category=otc",
    d: "M12 21s-7-4.3-9-8.4A5.2 5.2 0 0112 6a5.2 5.2 0 019 6.6c-2 4.1-9 8.4-9 8.4z",
  },
];

const TRUST = [
  { t: "Pan-India delivery", s: "Across serviceable pincodes", d: "M13 3L4 14h6l-1 7 9-11h-6z" },
  { t: "Cold-chain assured", s: "GDP-compliant, temperature logged", d: "M12 3v18M5 7l14 10M19 7L5 17" },
  { t: "CDSCO-verified", s: "Audited sourcing, batch traceable", d: "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z" },
  { t: "Role-based pricing", s: "Wholesale rates for verified buyers", d: "M3 17l5-6 4 3 5-7 4 5" },
];

/* The four stages a box passes through. Short labels on purpose — the detail
   lives on the FAQ and product pages; this is meant to be scanned in seconds. */
const FLOW = [
  {
    title: "From licensed makers",
    sub: "CDSCO-verified, batch recorded on arrival",
    d: "M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5M9 12h.01M15 12h.01",
  },
  {
    title: "Stored at 2–8°C",
    sub: "Cold chain logged at every handover",
    d: "M12 3v18M5 7l14 10M19 7L5 17M12 7l-3-3M12 7l3-3M12 17l-3 3M12 17l3 3",
  },
  {
    title: "Verified once",
    sub: "Drug licence or council registration",
    d: "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z",
  },
  {
    title: "Tracked delivery",
    sub: "Followed live to your door",
    d: "M3 16V7h11v9M14 10h4l3 3v3h-7M6.5 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zm11 0a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z",
  },
];

const FAQS = [
  {
    q: "Who can buy on Nethrasap?",
    a: "Anyone can buy over-the-counter products. Prescription medicines and wholesale pricing require a verified account — retailers upload a drug licence (20B/21B) and GSTIN, clinicians upload their council registration.",
  },
  {
    q: "How does verification work?",
    a: "Sign up with your phone number, upload your documents from your account page, and our compliance team reviews them. Until then you can browse and order OTC items at standard pricing.",
  },
  {
    q: "How are Schedule H and H1 medicines handled?",
    a: "They are dispensed only against a valid prescription, which is checked at delivery. Every Schedule drug is labelled on its product page so there are no surprises at the door.",
  },
  {
    q: "What payment methods are available?",
    a: "Cash or UPI on delivery is available today. Online payment (UPI, card and netbanking) is being enabled and will appear at checkout automatically once live.",
  },
  {
    q: "How is the cold chain maintained?",
    a: "Cold-chain items move through temperature-controlled storage and transit with logging at each handover, in line with GDP guidelines, so biologics and vaccines arrive within specification.",
  },
];

export default async function HomePage() {
  const { shelf, categories, catalogueSize } = await getData();

  return (
    <>
      <HeroCarousel />

      {/* Trust strip — sits directly under the hero so the promise is immediate. */}
      <section className="container" style={{ paddingTop: "var(--sp-6)" }}>
        <div className="card pad trust-strip">
          {TRUST.map((t) => (
            <div key={t.t} className="trust-item">
              <span className="ic">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={t.d} />
                </svg>
              </span>
              <span>
                <b style={{ display: "block", color: "var(--ink)" }}>{t.t}</b>
                {t.s}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="sec-head">
          <h2>Shop by category</h2>
          <Link href="/categories" className="small">
            All categories →
          </Link>
        </div>
        <CategoryRail categories={categories} />
      </section>

      <section className="section container" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <h2>Featured Products</h2>
          <Link href="/products" className="small">
            View all {catalogueSize} →
          </Link>
        </div>
        <div className="grid grid-shelf">
          {shelf.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      {/* Buyer segments — routes each audience to the right entry point. */}
      <section className="section container" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <h2>Built for how you buy</h2>
        </div>
        <div className="buyer-grid">
          {BUYERS.map((b) => (
            <Link key={b.title} href={b.href} className="buyer-card">
              <span className="ic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={b.d} />
                </svg>
              </span>
              <b>{b.title}</b>
              <p>{b.body}</p>
              <span className="buyer-go">Get started →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* About — told as the actual journey a box takes, because that is the
          question buyers really ask. Counts come from the live catalogue. */}
      <section className="about" id="about">
        <div className="container">
          <div className="about-lede">
            <span className="eyebrow">About Nethrasap</span>
            <h2>Every box we ship can be traced back to the maker.</h2>
            <p>
              We&apos;re a licensed healthcare distributor supplying pharmacies, clinics and
              hospitals across India. Here&apos;s what actually happens between the manufacturer
              and your shelf.
            </p>
          </div>

          <ol className="flow">
            {FLOW.map((s, i) => (
              <li key={s.title} className={i % 2 === 0 ? "is-down" : "is-up"}>
                <span className="flow-dot">
                  <span className="flow-ic">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={s.d} />
                    </svg>
                  </span>
                </span>
                <div className="flow-cap">
                  <span className="flow-stem" aria-hidden="true" />
                  <span className="flow-label">
                    <b>{s.title}</b>
                    <span>{s.sub}</span>
                  </span>
                </div>
              </li>
            ))}
          </ol>

          <div className="about-foot">
            <dl className="about-figures">
              <div>
                <dt>Products stocked</dt>
                <dd>{catalogueSize}</dd>
              </div>
              <div>
                <dt>Categories</dt>
                <dd>{categories.length}</dd>
              </div>
              <div>
                <dt>Cold chain</dt>
                <dd>2–8°C</dd>
              </div>
            </dl>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <Link href="/signup" className="btn btn-primary">
                Register your business
              </Link>
              <Link href="/products" className="btn btn-outline">
                Explore the catalogue
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — native details/summary: accessible and JS-free. */}
      <section className="section container">
        <div className="faq-head">
          <span className="eyebrow">Questions</span>
          <h2>Frequently asked</h2>
          <p>Ordering, verification and delivery — the things buyers ask us most.</p>
        </div>
        <div className="faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="container" style={{ paddingBottom: "var(--sp-10)" }}>
        <div className="cta-band">
          <span className="eyebrow">Get verified</span>
          <h3>Unlock wholesale pricing on your next order.</h3>
          <p>
            One document is all it takes. You can keep ordering at standard pricing while our
            team reviews it — nothing is blocked while you wait.
          </p>
          <div className="cta-actions">
            <Link href="/signup" className="btn btn-primary">
              Create your account
            </Link>
            <Link href="/products" className="btn btn-outline">
              Browse the catalogue
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
