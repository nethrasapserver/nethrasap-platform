import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/api";
import {
  DEFAULT_ABOUT_CTA,
  DEFAULT_ABOUT_FLOW,
  DEFAULT_ABOUT_HEADINGS,
  DEFAULT_ABOUT_INTROS,
  DEFAULT_CERTS,
  DEFAULT_FOUNDERS,
  DEFAULT_LOCATIONS,
  DEFAULT_PRINCIPLES,
  DEFAULT_STATS,
  DEFAULT_STORY_PARAS,
  STAT_SENTINEL_CATEGORIES,
  STAT_SENTINEL_PRODUCTS,
  arr,
  blocksOf,
  bySlot,
  firstBlock,
  getPage,
  str,
  type CmsBlock,
  type CmsPage,
  type CtaBand,
  type Founder,
  type IconItem,
  type Location,
  type Principle,
  type SectionHeading,
  type SectionIntro,
  type Stat,
} from "@/lib/content";

function resolveHeading(page: CmsPage, slot: string, fallback: SectionHeading): SectionHeading {
  const c = bySlot(page, "section_heading", slot)?.content;
  return {
    heading: str(c, "heading") ?? fallback.heading,
    link_label: str(c, "link_label") ?? fallback.link_label,
    link_href: str(c, "link_href") ?? fallback.link_href,
  };
}

function resolveIntro(page: CmsPage, slot: string, fallback: SectionIntro): SectionIntro {
  const c = bySlot(page, "section_intro", slot)?.content;
  return {
    eyebrow: str(c, "eyebrow") ?? fallback.eyebrow,
    heading: str(c, "heading") ?? fallback.heading,
    body: str(c, "body") ?? fallback.body,
  };
}

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

/* ---------- CMS block → view-model mappers ---------- */

function toIconItem(b: CmsBlock): IconItem {
  return { title: str(b.content, "title") ?? "", subtitle: str(b.content, "subtitle"), icon: str(b.content, "icon") ?? "" };
}

function toPrinciple(b: CmsBlock): Principle {
  return {
    title: str(b.content, "title") ?? "",
    body: str(b.content, "body") ?? "",
    icon: str(b.content, "icon") ?? "",
    tone: str(b.content, "tone") ?? "olive",
  };
}

function toStat(b: CmsBlock): Stat {
  return { value: str(b.content, "value") ?? "", label: str(b.content, "label") ?? "" };
}

function toFounder(b: CmsBlock): Founder {
  return {
    name: str(b.content, "name") ?? "",
    role: str(b.content, "role") ?? "",
    line: str(b.content, "line") ?? "",
    image_url: str(b.content, "image_url"),
  };
}

function toLocation(b: CmsBlock): Location {
  return { city: str(b.content, "city") ?? "", role: str(b.content, "role") ?? "", note: str(b.content, "note") ?? "" };
}

function resolveCta(c: Record<string, unknown> | undefined, fallback: CtaBand): CtaBand {
  return {
    eyebrow: str(c, "eyebrow") ?? fallback.eyebrow,
    heading: str(c, "heading") ?? fallback.heading,
    body: str(c, "body") ?? fallback.body,
    cta_label: str(c, "cta_label") ?? fallback.cta_label,
    cta_href: str(c, "cta_href") ?? fallback.cta_href,
    alt_label: str(c, "alt_label") ?? fallback.alt_label,
    alt_href: str(c, "alt_href") ?? fallback.alt_href,
  };
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("");
}

export default async function AboutPage() {
  const [figures, about] = await Promise.all([getFigures(), getPage("about")]);

  const resolveStatValue = (value: string): string => {
    if (value === STAT_SENTINEL_PRODUCTS) return figures.products > 0 ? String(figures.products) : "—";
    if (value === STAT_SENTINEL_CATEGORIES) return figures.categories > 0 ? String(figures.categories) : "—";
    return value;
  };

  const heroBlock = firstBlock(about, "about_hero");

  const statBlocks = blocksOf(about, "stat");
  const stats = statBlocks.length > 0 ? statBlocks.map(toStat) : DEFAULT_STATS;

  const storyBlocks = blocksOf(about, "story_para");
  const storyParas = storyBlocks.length > 0 ? storyBlocks.map((b) => str(b.content, "text") ?? "") : DEFAULT_STORY_PARAS;

  const principleBlocks = blocksOf(about, "principle");
  const principles = principleBlocks.length > 0 ? principleBlocks.map(toPrinciple) : DEFAULT_PRINCIPLES;

  const flowBlocks = blocksOf(about, "flow_step");
  const flow = flowBlocks.length > 0 ? flowBlocks.map(toIconItem) : DEFAULT_ABOUT_FLOW;

  const founderBlocks = blocksOf(about, "founder");
  const founders = founderBlocks.length > 0 ? founderBlocks.map(toFounder) : DEFAULT_FOUNDERS;

  const locationBlocks = blocksOf(about, "location");
  const locations = locationBlocks.length > 0 ? locationBlocks.map(toLocation) : DEFAULT_LOCATIONS;

  const certBlocks = blocksOf(about, "cert");
  const certs = certBlocks.length > 0 ? certBlocks.map((b) => str(b.content, "label") ?? "").filter(Boolean) : DEFAULT_CERTS;

  const cta = resolveCta(firstBlock(about, "cta_band")?.content, DEFAULT_ABOUT_CTA);

  // Section headings / intros — CMS-editable (global pattern), in-code defaults.
  const storyHead = resolveIntro(about, "story", DEFAULT_ABOUT_INTROS.story);
  const principlesHead = resolveHeading(about, "principles", DEFAULT_ABOUT_HEADINGS.principles);
  const operateHead = resolveIntro(about, "operate", DEFAULT_ABOUT_INTROS.operate);
  const foundersHead = resolveIntro(about, "founders", DEFAULT_ABOUT_INTROS.founders);
  const networkHead = resolveIntro(about, "network", DEFAULT_ABOUT_INTROS.network);
  const networkFoot = resolveIntro(about, "network_foot", DEFAULT_ABOUT_INTROS.network_foot);
  const complianceHead = resolveIntro(about, "compliance", DEFAULT_ABOUT_INTROS.compliance);

  return (
    <div className="ab-page">
      {/* 1 — Who we are: full-bleed photographic hero with a brand scrim. */}
      <section className="ab-hero">
        <div className="container ab-hero-inner">
          {heroBlock ? (
            <>
              <span className="eyebrow">{str(heroBlock.content, "eyebrow") ?? "About Nethrasap"}</span>
              <h1>{str(heroBlock.content, "title")}</h1>
              <p>{str(heroBlock.content, "body")}</p>
              <div className="row ab-hero-cta">
                <Link href={str(heroBlock.content, "cta_href") ?? "/products"} className="btn btn-primary">
                  {str(heroBlock.content, "cta_label") ?? "Browse products"}
                </Link>
                {str(heroBlock.content, "alt_href") && (
                  <Link href={str(heroBlock.content, "alt_href")!} className="btn btn-outline">
                    {str(heroBlock.content, "alt_label") ?? "Register your business"}
                  </Link>
                )}
              </div>
              <div className="ab-hero-facts">
                {arr(heroBlock.content, "facts").map((f, i) => (
                  <span key={i}>{String(f)}</span>
                ))}
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </section>

      {/* 2 — Figures. The products/categories cells stay live via sentinels. */}
      <section className="container">
        <dl className="ab-stats card">
          {stats.map((s) => (
            <div key={s.label}>
              <dd>{resolveStatValue(s.value)}</dd>
              <dt>{s.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* 3 — Our story */}
      <section className="container section ab-story">
        <div className="ab-story-head">
          <span className="eyebrow">{storyHead.eyebrow}</span>
          <h2>{storyHead.heading}</h2>
        </div>
        <div className="ab-story-body">
          {storyParas.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {/* 4 — Principles */}
      <section className="container section" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <h2>{principlesHead.heading}</h2>
        </div>
        <div className="ab-principles">
          {principles.map((p) => (
            <article key={p.title} className={`ab-principle ${p.tone === "ice" ? "is-ice" : ""}`}>
              <span className="ab-principle-ic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={p.icon} />
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
            <span className="eyebrow">{operateHead.eyebrow}</span>
            <h2>{operateHead.heading}</h2>
            {operateHead.body && <p>{operateHead.body}</p>}
          </div>
          <ol className="flow">
            {flow.map((s, i) => (
              <li key={s.title} className={i % 2 === 0 ? "is-down" : "is-up"}>
                <span className="flow-dot">
                  <span className="flow-ic">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={s.icon} />
                    </svg>
                  </span>
                </span>
                <div className="flow-cap">
                  <span className="flow-stem" aria-hidden="true" />
                  <span className="flow-label">
                    <b>{s.title}</b>
                    <span>{s.subtitle}</span>
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
          <span className="eyebrow">{foundersHead.eyebrow}</span>
          <h2>{foundersHead.heading}</h2>
        </div>
        <div className="ab-people">
          {founders.map((m) => (
            <article key={m.name} className="ab-person">
              <span className="ab-person-avatar">
                {m.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
                ) : (
                  initials(m.name)
                )}
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
            <span className="eyebrow">{networkHead.eyebrow}</span>
            <h2>{networkHead.heading}</h2>
            {networkHead.body && <p>{networkHead.body}</p>}
          </div>
          <div className="ab-locations">
            {locations.map((l) => (
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
          {networkFoot.body && <p className="small muted ab-network-foot">{networkFoot.body}</p>}
        </div>
      </section>

      {/* 8 — Compliance strip */}
      <section className="container section ab-certs">
        <span className="eyebrow">{complianceHead.eyebrow}</span>
        <div className="ab-cert-chips">
          {certs.map((c) => (
            <span key={c} className="ab-cert-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 12l2 2 4-5" />
              </svg>
              {c}
            </span>
          ))}
        </div>
        {complianceHead.body && <p className="small muted">{complianceHead.body}</p>}
      </section>

      {/* 9 — Closing CTA */}
      <section className="container" style={{ paddingBottom: "var(--sp-10)" }}>
        <div className="cta-band">
          <span className="eyebrow">{cta.eyebrow}</span>
          <h3>{cta.heading}</h3>
          <p>{cta.body}</p>
          <div className="cta-actions">
            <Link href={cta.cta_href} className="btn btn-primary">{cta.cta_label}</Link>
            {cta.alt_label && cta.alt_href && (
              <Link href={cta.alt_href} className="btn btn-outline">{cta.alt_label}</Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
