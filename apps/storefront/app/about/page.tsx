import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/api";

export const metadata: Metadata = {
  title: "About us",
  description:
    "Nethrasap is India's audited healthcare supply platform — CDSCO-verified sourcing, GDP-compliant cold chain, and fair role-based pricing for pharmacies, clinicians and homes.",
};

export const dynamic = "force-dynamic";

/* Live figures where we have them; the rest are company placeholders clearly
   marked — swap once marketing signs off on real numbers. */
async function getFigures() {
  try {
    const api = serverApi();
    const [products, categories] = await Promise.all([
      api.get<{ total: number }>("/products", { limit: 1 }),
      api.get<{ items: unknown[] }>("/categories", { limit: 50 }),
    ]);
    return { products: products.total, categories: categories.items.length };
  } catch {
    return { products: 0, categories: 0 };
  }
}

/* Same journey shown on the home page — one story everywhere. */
const FLOW = [
  {
    title: "Sourced from licensed makers",
    sub: "CDSCO-verified, batch recorded on arrival",
    d: "M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5M9 12h.01M15 12h.01",
  },
  {
    title: "QC + batch logging",
    sub: "Every unit traceable to its manufacturer",
    d: "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z",
  },
  {
    title: "Stored at 2–8°C",
    sub: "GDP cold chain, logged at every handover",
    d: "M12 3v18M5 7l14 10M19 7L5 17M12 7l-3-3M12 7l3-3M12 17l-3 3M12 17l3 3",
  },
  {
    title: "Delivered to your door",
    sub: "Pan-India, cash on delivery",
    d: "M3 16V7h11v9M14 10h4l3 3v3h-7M6.5 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zm11 0a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z",
  },
];

const PRINCIPLES = [
  {
    title: "Verified by default",
    body: "Every manufacturer is CDSCO-audited before a single unit enters our warehouse. Buyers verify once — a drug licence or council registration — and it works everywhere on the platform.",
    d: "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z",
    tone: "olive",
  },
  {
    title: "Priced fairly by role",
    body: "Retailers, clinicians and households each see pricing that fits how they buy. Bulk needs get a human quote you can negotiate — nothing is charged until you accept.",
    d: "M3 17l5-6 4 3 5-7 4 5",
    tone: "olive",
  },
  {
    title: "Cold chain, never broken",
    body: "Biologics and vaccines travel at 2–8°C from the maker's dock to your door, with the temperature logged at every handover. If the chain breaks, the box never ships.",
    d: "M12 3v18M5 7l14 10M19 7L5 17",
    tone: "ice",
  },
];

const CERTS = [
  "CDSCO-verified sourcing",
  "GDP-compliant cold chain",
  "Drug licence 20B / 21B",
  "GST registered",
  "Batch-level traceability",
];

/* PLACEHOLDER founders — swap names, roles and bios once confirmed. */
const FOUNDERS = [
  {
    name: "Arvind Rajan",
    role: "Co-founder · CEO",
    line: "Fifteen years in pharma distribution before deciding the paperwork should prove itself. Sets the sourcing bar: no audit, no shelf.",
  },
  {
    name: "Meera Krishnan",
    role: "Co-founder · Operations",
    line: "Built the cold-chain playbook — every 2–8°C handover logged, every exception escalated before the box moves another metre.",
  },
  {
    name: "Karthik Subramanian",
    role: "Co-founder · Technology",
    line: "Wrote the first batch-traceability system on a warehouse floor. Believes software should disappear behind a clean invoice.",
  },
];

/* PLACEHOLDER network — swap cities/roles when the facility list is final. */
const LOCATIONS = [
  { city: "Chennai", role: "Headquarters · cold-chain hub", note: "Primary warehouse, QC and batch intake" },
  { city: "Coimbatore", role: "Fulfilment centre", note: "Western Tamil Nadu, next-day lanes" },
  { city: "Bengaluru", role: "Cold-chain hub", note: "Biologics and vaccine distribution" },
  { city: "Hyderabad", role: "Fulfilment centre", note: "Telangana and Andhra coverage" },
  { city: "Mumbai", role: "Fulfilment centre", note: "Western region wholesale lanes" },
  { city: "Delhi NCR", role: "Fulfilment centre", note: "Northern region coverage" },
];

export default async function AboutPage() {
  const figures = await getFigures();

  return (
    <div className="ab-page">
      {/* 1 — Who we are: full-bleed photographic hero with a brand scrim. */}
      <section className="ab-hero">
        <div className="container ab-hero-inner">
          <span className="eyebrow">About Nethrasap</span>
          <h1>
            India&apos;s audited healthcare supply chain,
            <br /> built for the people who run it.
          </h1>
          <p>
            Nethrasap is one licensed source for prescription medicines, OTC, devices and
            cold-chain biologics — supplying retail pharmacies, clinicians and homes across
            India. Every box we ship can be traced back to the maker.
          </p>
          <div className="row ab-hero-cta">
            <Link href="/products" className="btn btn-primary">Browse products</Link>
            <Link href="/signup" className="btn btn-outline">Register your business</Link>
          </div>
          <div className="ab-hero-facts">
            <span>CDSCO-verified sourcing</span>
            <span>GDP cold chain, 2–8°C</span>
            <span>Pan-India delivery</span>
          </div>
        </div>
      </section>

      {/* 2 — Figures */}
      <section className="container">
        <dl className="ab-stats card">
          <div>
            <dd>{figures.products > 0 ? figures.products : "—"}</dd>
            <dt>Products stocked</dt>
          </div>
          <div>
            <dd>{figures.categories > 0 ? figures.categories : "—"}</dd>
            <dt>Categories</dt>
          </div>
          <div>
            <dd>2–8°C</dd>
            <dt>Cold chain, logged</dt>
          </div>
          <div>
            <dd>100%</dd>
            <dt>Batch traceable</dt>
          </div>
        </dl>
      </section>

      {/* 3 — Our story */}
      <section className="container section ab-story">
        <div className="ab-story-head">
          <span className="eyebrow">Our story</span>
          <h2>It started with one question: where did this box come from?</h2>
        </div>
        <div className="ab-story-body">
          <p>
            Anyone who has run a pharmacy counter in India knows the feeling — a carton
            arrives from the third distributor this month, the invoice doesn&apos;t match the
            batch, and there is no way to know how it was stored on the way. The supply
            chain worked, but nobody could prove it.
          </p>
          <p>
            We started Nethrasap to make the proof part of the product. One warehouse, one
            promise: every unit logged to its manufacturer batch on arrival, every cold-chain
            handover recorded, every invoice matching what&apos;s physically in the box.
          </p>
          <p>
            Today that same discipline runs a full platform — wholesale slabs for verified
            retailers, clinician pricing for practices and hospitals, transparent MRP for
            households, and negotiable quotes for bulk buying. Different buyers, one audited
            chain behind all of them.
          </p>
        </div>
      </section>

      {/* 4 — Principles */}
      <section className="container section" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <h2>What we stand for</h2>
        </div>
        <div className="ab-principles">
          {PRINCIPLES.map((p) => (
            <article key={p.title} className={`ab-principle ${p.tone === "ice" ? "is-ice" : ""}`}>
              <span className="ab-principle-ic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={p.d} />
                </svg>
              </span>
              <b>{p.title}</b>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 5 — How we operate (same flow language as home) */}
      <section className="about">
        <div className="container">
          <div className="about-lede">
            <span className="eyebrow">How we operate</span>
            <h2>Four steps, no shortcuts.</h2>
            <p>The journey every single box takes — whether it&apos;s one strip or one pallet.</p>
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
        </div>
      </section>

      {/* 6 — Founders */}
      <section className="container section">
        <div className="ab-sec-head">
          <span className="eyebrow">The founders</span>
          <h2>Three people who got tired of unverifiable boxes.</h2>
        </div>
        <div className="ab-people">
          {FOUNDERS.map((m) => (
            <article key={m.name} className="ab-person">
              <span className="ab-person-avatar">
                {m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </span>
              <b>{m.name}</b>
              <span className="ab-person-role">{m.role}</span>
              <p>{m.line}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 7 — Locations */}
      <section className="ab-network">
        <div className="container section">
          <div className="ab-sec-head">
            <span className="eyebrow">Where we operate</span>
            <h2>Six facilities. One audited network.</h2>
            <p>
              Stock moves between our hubs under the same batch log it arrived with —
              wherever you are, the paper trail travels with the box.
            </p>
          </div>
          <div className="ab-locations">
            {LOCATIONS.map((l) => (
              <article key={l.city} className="ab-location">
                <span className="ab-location-pin">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z M12 10a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2z" />
                  </svg>
                </span>
                <b>{l.city}</b>
                <span className="ab-location-role">{l.role}</span>
                <p>{l.note}</p>
              </article>
            ))}
          </div>
          <p className="small muted ab-network-foot">
            Registered office: Nethrasap Healthcare Supply Pvt. Ltd., Chennai, Tamil Nadu ·
            Support: +91 44 4000 0000 (placeholder)
          </p>
        </div>
      </section>

      {/* 8 — Compliance strip */}
      <section className="container section ab-certs">
        <span className="eyebrow">Compliance</span>
        <div className="ab-cert-chips">
          {CERTS.map((c) => (
            <span key={c} className="ab-cert-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 12l2 2 4-5" />
              </svg>
              {c}
            </span>
          ))}
        </div>
        <p className="small muted">
          Licence and certification documents are available on request for verified business buyers.
        </p>
      </section>

      {/* 9 — Closing CTA */}
      <section className="container" style={{ paddingBottom: "var(--sp-10)" }}>
        <div className="cta-band">
          <span className="eyebrow">Buy the audited way</span>
          <h3>One verified account. Every category on one invoice.</h3>
          <p>
            Keep ordering at standard pricing while our team verifies your documents —
            nothing is blocked while you wait.
          </p>
          <div className="cta-actions">
            <Link href="/signup" className="btn btn-primary">Create your account</Link>
            <Link href="/products" className="btn btn-outline">Explore the catalogue</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
