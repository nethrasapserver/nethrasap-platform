import type { CategoryItem, ProductListItem } from "@nethrasap/api-client";
import Link from "next/link";
import { CategoryRail } from "@/components/CategoryRail";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ProductCard } from "@/components/ProductCard";
import { serverApi } from "@/lib/api";
import {
  DEFAULT_BUYERS,
  DEFAULT_FAQS,
  DEFAULT_HOME_CTA,
  DEFAULT_HOME_FLOW,
  DEFAULT_HOME_HEADINGS,
  DEFAULT_HOME_INTROS,
  DEFAULT_TRUST,
  blocksOf,
  bySlot,
  firstBlock,
  getPage,
  str,
  type BuyerCard,
  type CmsBlock,
  type CmsPage,
  type CtaBand,
  type FaqItem,
  type HeroSlideData,
  type HeroTheme,
  type IconItem,
  type SectionHeading,
  type SectionIntro,
} from "@/lib/content";

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

/* ---------- CMS block → view-model mappers (all fields optional-chained) ---------- */

function toHeroSlide(b: CmsBlock, i: number): HeroSlideData {
  const c = b.content;
  return {
    key: str(c, "key") ?? `slide-${i}`,
    eyebrow: str(c, "eyebrow") ?? "",
    title: str(c, "title") ?? "",
    body: str(c, "body") ?? "",
    cta_label: str(c, "cta_label") ?? "",
    cta_href: str(c, "cta_href") ?? "#",
    alt_label: str(c, "alt_label"),
    alt_href: str(c, "alt_href"),
    theme: (str(c, "theme") ?? "olive") as HeroTheme,
    image_url: str(c, "image_url"),
  };
}

function toIconItem(b: CmsBlock): IconItem {
  return {
    title: str(b.content, "title") ?? "",
    subtitle: str(b.content, "subtitle"),
    icon: str(b.content, "icon") ?? "",
    image_url: str(b.content, "image_url"),
  };
}

function toBuyer(b: CmsBlock): BuyerCard {
  return {
    title: str(b.content, "title") ?? "",
    body: str(b.content, "body") ?? "",
    href: str(b.content, "href") ?? "#",
    icon: str(b.content, "icon") ?? "",
  };
}

function toFaq(b: CmsBlock): FaqItem {
  return { question: str(b.content, "question") ?? "", answer: str(b.content, "answer") ?? "" };
}

function resolveHeading(page: CmsPage, slot: string, fallback: SectionHeading, linkLabelFallback?: string): SectionHeading {
  const c = bySlot(page, "section_heading", slot)?.content;
  return {
    heading: str(c, "heading") ?? fallback.heading,
    link_label: str(c, "link_label") ?? linkLabelFallback ?? fallback.link_label,
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

function resolveCta(page: CmsPage, fallback: CtaBand): CtaBand {
  const c = firstBlock(page, "cta_band")?.content;
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

export default async function HomePage() {
  const [{ shelf, categories, catalogueSize }, home] = await Promise.all([getData(), getPage("home")]);

  // Marketing content — CMS with in-code DEFAULTS on any missing page/block.
  const heroBlocks = blocksOf(home, "hero_slide");
  const heroSlides = heroBlocks.length > 0 ? heroBlocks.map(toHeroSlide) : undefined; // undefined → carousel uses its own defaults

  const trustBlocks = blocksOf(home, "trust_badge");
  const trust = trustBlocks.length > 0 ? trustBlocks.map(toIconItem) : DEFAULT_TRUST;

  const buyerBlocks = blocksOf(home, "buyer_card");
  const buyers = buyerBlocks.length > 0 ? buyerBlocks.map(toBuyer) : DEFAULT_BUYERS;

  const flowBlocks = blocksOf(home, "flow_step");
  const flow = flowBlocks.length > 0 ? flowBlocks.map(toIconItem) : DEFAULT_HOME_FLOW;

  const faqBlocks = blocksOf(home, "faq_item");
  const faqs = faqBlocks.length > 0 ? faqBlocks.map(toFaq) : DEFAULT_FAQS;

  const categoryHead = resolveHeading(home, "category", DEFAULT_HOME_HEADINGS.category);
  const featuredHead = resolveHeading(home, "featured", DEFAULT_HOME_HEADINGS.featured, `View all ${catalogueSize} →`);
  const buyersHead = resolveHeading(home, "buyers", DEFAULT_HOME_HEADINGS.buyers);
  const aboutIntro = resolveIntro(home, "about", DEFAULT_HOME_INTROS.about);
  const faqIntro = resolveIntro(home, "faq", DEFAULT_HOME_INTROS.faq);
  const cta = resolveCta(home, DEFAULT_HOME_CTA);

  return (
    <>
      <HeroCarousel slides={heroSlides} />

      {/* Trust strip — sits directly under the hero so the promise is immediate. */}
      <section className="container" style={{ paddingTop: "var(--sp-6)" }}>
        <div className="card pad trust-strip">
          {trust.map((t) => (
            <div key={t.title} className="trust-item">
              <span className="ic">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={t.icon} />
                </svg>
              </span>
              <span>
                <b style={{ display: "block", color: "var(--ink)" }}>{t.title}</b>
                {t.subtitle}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="sec-head">
          <h2>{categoryHead.heading}</h2>
          {categoryHead.link_href && (
            <Link href={categoryHead.link_href} className="small">
              {categoryHead.link_label}
            </Link>
          )}
        </div>
        <CategoryRail categories={categories} />
      </section>

      <section className="section container" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <h2>{featuredHead.heading}</h2>
          {featuredHead.link_href && (
            <Link href={featuredHead.link_href} className="small">
              {featuredHead.link_label}
            </Link>
          )}
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
          <h2>{buyersHead.heading}</h2>
        </div>
        <div className="buyer-grid">
          {buyers.map((b) => (
            <Link key={b.title} href={b.href} className="buyer-card">
              <span className="ic">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={b.icon} />
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
            <span className="eyebrow">{aboutIntro.eyebrow}</span>
            <h2>{aboutIntro.heading}</h2>
            <p>{aboutIntro.body}</p>
          </div>

          <ol className="flow">
            {flow.map((s, i) => (
              <li key={s.title} className={i % 2 === 0 ? "is-down" : "is-up"}>
                <span className="flow-dot">
                  {s.image_url ? (
                    <span className="flow-ic flow-ic-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.image_url} alt="" />
                    </span>
                  ) : (
                    <span className="flow-ic">
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={s.icon} />
                      </svg>
                    </span>
                  )}
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
          <span className="eyebrow">{faqIntro.eyebrow}</span>
          <h2>{faqIntro.heading}</h2>
          <p>{faqIntro.body}</p>
        </div>
        <div className="faq">
          {faqs.map((f) => (
            <details key={f.question}>
              <summary>{f.question}</summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="container" style={{ paddingBottom: "var(--sp-10)" }}>
        <div className="cta-band">
          <span className="eyebrow">{cta.eyebrow}</span>
          <h3>{cta.heading}</h3>
          <p>{cta.body}</p>
          <div className="cta-actions">
            <Link href={cta.cta_href} className="btn btn-primary">
              {cta.cta_label}
            </Link>
            {cta.alt_label && cta.alt_href && (
              <Link href={cta.alt_href} className="btn btn-outline">
                {cta.alt_label}
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
