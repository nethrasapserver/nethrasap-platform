import { API_PREFIX } from "@nethrasap/api-client";

/**
 * CMS content access for the storefront's marketing surfaces.
 *
 * The backend serves published pages at GET /api/v1/cms/pages/{slug} returning
 * { slug, title, blocks:[{kind, sort_order, is_active, content}] } (already
 * filtered to published pages + active blocks, sorted). We fetch it with
 * tag-based revalidation so the dashboard can bust a single page's cache via
 * POST /api/revalidate on save.
 *
 * NOTE: we deliberately do NOT route this through serverApi().get(): that client
 * hardcodes `cache: "no-store"` and does not forward Next fetch options, so
 * `next.tags` (and therefore revalidateTag) would never take effect. This
 * endpoint is public — no auth header needed — so a plain tagged fetch against
 * the same base the server client resolves is both correct and cacheable.
 *
 * Every accessor is defensive: unknown shapes read through optional chaining and
 * callers always have in-code DEFAULTS to fall back to, so a missing page, a
 * missing block, or a malformed field can never blank the UI.
 */

export interface CmsBlock {
  kind: string;
  sort_order: number;
  is_active: boolean;
  content: Record<string, unknown>;
}

export interface CmsPage {
  slug: string;
  title: string;
  blocks: CmsBlock[];
}

function cmsBase(): string {
  return (
    process.env.API_PROXY_TARGET ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000"
  );
}

const EMPTY_PAGE = (slug: string): CmsPage => ({ slug, title: "", blocks: [] });

/** Fetch a published CMS page. Never throws — on any failure (404, network,
 *  malformed JSON) it returns an empty page so callers fall back to DEFAULTS. */
export async function getPage(slug: string): Promise<CmsPage> {
  try {
    // Live read: the marketing pages are force-dynamic (render per request)
    // anyway, so fetch the CMS uncached — dashboard edits show immediately with
    // no revalidate webhook. (For production perf, switch to
    // `next:{revalidate,tags}` + an on-demand purge via a dashboard-side route.)
    const res = await fetch(`${cmsBase()}${API_PREFIX}/cms/pages/${slug}`, {
      cache: "no-store",
    });
    if (!res.ok) return EMPTY_PAGE(slug);
    const data = (await res.json()) as Partial<CmsPage> | null;
    const blocks = Array.isArray(data?.blocks) ? (data!.blocks as CmsBlock[]) : [];
    return {
      slug: typeof data?.slug === "string" ? data.slug : slug,
      title: typeof data?.title === "string" ? data.title : "",
      blocks: blocks.filter((b) => b && typeof b.kind === "string"),
    };
  } catch {
    return EMPTY_PAGE(slug);
  }
}

/** Active blocks of a given kind, in sort order. */
export function blocksOf(page: CmsPage, kind: string): CmsBlock[] {
  return page.blocks
    .filter((b) => b.kind === kind && b.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/** First active block of a kind, if any. */
export function firstBlock(page: CmsPage, kind: string): CmsBlock | undefined {
  return blocksOf(page, kind)[0];
}

/** First active block of a kind whose content.slot matches. */
export function bySlot(page: CmsPage, kind: string, slot: string): CmsBlock | undefined {
  return blocksOf(page, kind).find((b) => str(b.content, "slot") === slot);
}

/** Read a string field, returning undefined for anything non-string/empty. */
export function str(content: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = content?.[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Read an array field, returning [] for anything that is not an array. */
export function arr(content: Record<string, unknown> | undefined, key: string): unknown[] {
  const v = content?.[key];
  return Array.isArray(v) ? v : [];
}

/* ==========================================================================
   DEFAULTS — mirror the previously-hardcoded arrays verbatim. Every dynamic
   section degrades to these when the matching CMS page/block is absent, so the
   storefront renders identically to before if the CMS is empty or unreachable.
   ========================================================================== */

/* ---------- home ---------- */

export type HeroTheme = "olive" | "cream" | "ice";

export interface HeroSlideData {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  cta_label: string;
  cta_href: string;
  alt_label?: string;
  alt_href?: string;
  theme: HeroTheme;
  image_url?: string;
}

export const DEFAULT_HERO_SLIDES: HeroSlideData[] = [
  {
    key: "delivery",
    eyebrow: "Serviceable pincodes",
    title: "Everything for your pharmacy, delivered to your door.",
    body: "Prescription medicines, OTC, devices and cold-chain biologics — one audited supply chain.",
    cta_label: "Browse products",
    cta_href: "/products",
    alt_label: "Track an order",
    alt_href: "/track",
    theme: "olive",
  },
  {
    key: "pricing",
    eyebrow: "Verified buyers",
    title: "Wholesale pricing for retailers and clinicians.",
    body: "Complete KYC once — drug licence or council registration — and your tier pricing applies everywhere.",
    cta_label: "Register your business",
    cta_href: "/signup",
    alt_label: "See categories",
    alt_href: "/categories",
    theme: "cream",
  },
  {
    key: "range",
    eyebrow: "One supplier",
    title: "Medicines, devices and daily care in one order.",
    body: "Prescription and OTC, diagnostics, surgical consumables, baby care and cold-chain biologics — every category on one invoice.",
    cta_label: "Browse all categories",
    cta_href: "/categories",
    alt_label: "Shop cold chain",
    alt_href: "/products?category=cold-chain",
    theme: "ice",
  },
];

export interface IconItem {
  title: string;
  subtitle?: string;
  icon: string;
}

/** trust_badge{title,subtitle,icon} — icon is an SVG path (the `d` attribute). */
export const DEFAULT_TRUST: IconItem[] = [
  { title: "Pan-India delivery", subtitle: "Across serviceable pincodes", icon: "M13 3L4 14h6l-1 7 9-11h-6z" },
  { title: "Cold-chain assured", subtitle: "GDP-compliant, temperature logged", icon: "M12 3v18M5 7l14 10M19 7L5 17" },
  { title: "CDSCO-verified", subtitle: "Audited sourcing, batch traceable", icon: "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z" },
  { title: "Role-based pricing", subtitle: "Wholesale rates for verified buyers", icon: "M3 17l5-6 4 3 5-7 4 5" },
];

export interface BuyerCard {
  title: string;
  body: string;
  href: string;
  icon: string;
}

export const DEFAULT_BUYERS: BuyerCard[] = [
  {
    title: "Retail pharmacies",
    body: "Drug licence (20B/21B) + GSTIN verified once. Wholesale slabs, credit-friendly COD, batch-level invoices.",
    href: "/signup",
    icon: "M4 7h16M6 7v12a2 2 0 002 2h8a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2",
  },
  {
    title: "Clinicians & hospitals",
    body: "Council registration verified. Clinician pricing, Schedule H/H1 handling, cold-chain biologics.",
    href: "/signup",
    icon: "M12 3v18M3 12h18",
  },
  {
    title: "Home & self care",
    body: "OTC essentials, devices and wellness delivered without a prescription, at transparent MRP.",
    href: "/products?category=otc",
    icon: "M12 21s-7-4.3-9-8.4A5.2 5.2 0 0112 6a5.2 5.2 0 019 6.6c-2 4.1-9 8.4-9 8.4z",
  },
];

/** flow_step{title,subtitle,icon} — the four stages a box passes through. */
export const DEFAULT_HOME_FLOW: IconItem[] = [
  { title: "From licensed makers", subtitle: "CDSCO-verified, batch recorded on arrival", icon: "M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5M9 12h.01M15 12h.01" },
  { title: "Stored at 2–8°C", subtitle: "Cold chain logged at every handover", icon: "M12 3v18M5 7l14 10M19 7L5 17M12 7l-3-3M12 7l3-3M12 17l-3 3M12 17l3 3" },
  { title: "Verified once", subtitle: "Drug licence or council registration", icon: "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z" },
  { title: "Tracked delivery", subtitle: "Followed live to your door", icon: "M3 16V7h11v9M14 10h4l3 3v3h-7M6.5 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zm11 0a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z" },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const DEFAULT_FAQS: FaqItem[] = [
  {
    question: "Who can buy on Nethrasap?",
    answer: "Anyone can buy over-the-counter products. Prescription medicines and wholesale pricing require a verified account — retailers upload a drug licence (20B/21B) and GSTIN, clinicians upload their council registration.",
  },
  {
    question: "How does verification work?",
    answer: "Sign up with your phone number, upload your documents from your account page, and our compliance team reviews them. Until then you can browse and order OTC items at standard pricing.",
  },
  {
    question: "How are Schedule H and H1 medicines handled?",
    answer: "They are dispensed only against a valid prescription, which is checked at delivery. Every Schedule drug is labelled on its product page so there are no surprises at the door.",
  },
  {
    question: "What payment methods are available?",
    answer: "Cash or UPI on delivery is available today. Online payment (UPI, card and netbanking) is being enabled and will appear at checkout automatically once live.",
  },
  {
    question: "How is the cold chain maintained?",
    answer: "Cold-chain items move through temperature-controlled storage and transit with logging at each handover, in line with GDP guidelines, so biologics and vaccines arrive within specification.",
  },
];

export interface SectionHeading {
  heading: string;
  link_label?: string;
  link_href?: string;
}

/** section_heading{slot,heading,link_label?,link_href?}, keyed by slot. */
export const DEFAULT_HOME_HEADINGS: Record<string, SectionHeading> = {
  category: { heading: "Shop by category", link_label: "All categories →", link_href: "/categories" },
  // featured link label is composed with the live catalogue size at render time.
  featured: { heading: "Featured Products", link_href: "/products" },
  buyers: { heading: "Built for how you buy" },
};

export interface SectionIntro {
  eyebrow: string;
  heading: string;
  body: string;
}

/** section_intro{slot,eyebrow,heading,body}, keyed by slot. */
export const DEFAULT_HOME_INTROS: Record<string, SectionIntro> = {
  about: {
    eyebrow: "About Nethrasap",
    heading: "Every box we ship can be traced back to the maker.",
    body: "We're a licensed healthcare distributor supplying pharmacies, clinics and hospitals across India. Here's what actually happens between the manufacturer and your shelf.",
  },
  faq: {
    eyebrow: "Questions",
    heading: "Frequently asked",
    body: "Ordering, verification and delivery — the things buyers ask us most.",
  },
};

/** About-page section headings, keyed by slot (section_heading{slot,…}). */
export const DEFAULT_ABOUT_HEADINGS: Record<string, SectionHeading> = {
  principles: { heading: "What we stand for" },
};

/** About-page section intros, keyed by slot (section_intro{slot,…}). */
export const DEFAULT_ABOUT_INTROS: Record<string, SectionIntro> = {
  story: { eyebrow: "Our story", heading: "It started with one question: where did this box come from?", body: "" },
  operate: {
    eyebrow: "How we operate",
    heading: "Four steps, no shortcuts.",
    body: "The journey every single box takes — whether it's one strip or one pallet.",
  },
  founders: { eyebrow: "The founders", heading: "Three people who got tired of unverifiable boxes.", body: "" },
  network: {
    eyebrow: "Where we operate",
    heading: "Six facilities. One audited network.",
    body: "Stock moves between our hubs under the same batch log it arrived with — wherever you are, the paper trail travels with the box.",
  },
  network_foot: {
    eyebrow: "",
    heading: "",
    body: "Registered office: Nethrasap Healthcare Supply Pvt. Ltd., Chennai, Tamil Nadu · Support: +91 44 4000 0000 (placeholder)",
  },
  compliance: {
    eyebrow: "Compliance",
    heading: "",
    body: "Licence and certification documents are available on request for verified business buyers.",
  },
};

export interface CtaBand {
  eyebrow: string;
  heading: string;
  body: string;
  cta_label: string;
  cta_href: string;
  alt_label?: string;
  alt_href?: string;
}

export const DEFAULT_HOME_CTA: CtaBand = {
  eyebrow: "Get verified",
  heading: "Unlock wholesale pricing on your next order.",
  body: "One document is all it takes. You can keep ordering at standard pricing while our team reviews it — nothing is blocked while you wait.",
  cta_label: "Create your account",
  cta_href: "/signup",
  alt_label: "Browse the catalogue",
  alt_href: "/products",
};

/* ---------- about ---------- */

export const DEFAULT_ABOUT_FLOW: IconItem[] = [
  { title: "Sourced from licensed makers", subtitle: "CDSCO-verified, batch recorded on arrival", icon: "M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5M9 12h.01M15 12h.01" },
  { title: "QC + batch logging", subtitle: "Every unit traceable to its manufacturer", icon: "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z" },
  { title: "Stored at 2–8°C", subtitle: "GDP cold chain, logged at every handover", icon: "M12 3v18M5 7l14 10M19 7L5 17M12 7l-3-3M12 7l3-3M12 17l-3 3M12 17l3 3" },
  { title: "Delivered to your door", subtitle: "Pan-India, cash on delivery", icon: "M3 16V7h11v9M14 10h4l3 3v3h-7M6.5 19a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zm11 0a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z" },
];

export interface Principle {
  title: string;
  body: string;
  icon: string;
  tone: string;
}

export const DEFAULT_PRINCIPLES: Principle[] = [
  {
    title: "Verified by default",
    body: "Every manufacturer is CDSCO-audited before a single unit enters our warehouse. Buyers verify once — a drug licence or council registration — and it works everywhere on the platform.",
    icon: "M9 12l2 2 4-5M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7z",
    tone: "olive",
  },
  {
    title: "Priced fairly by role",
    body: "Retailers, clinicians and households each see pricing that fits how they buy. Bulk needs get a human quote you can negotiate — nothing is charged until you accept.",
    icon: "M3 17l5-6 4 3 5-7 4 5",
    tone: "olive",
  },
  {
    title: "Cold chain, never broken",
    body: "Biologics and vaccines travel at 2–8°C from the maker's dock to your door, with the temperature logged at every handover. If the chain breaks, the box never ships.",
    icon: "M12 3v18M5 7l14 10M19 7L5 17",
    tone: "ice",
  },
];

/** stat{value,label}. The first two values are live sentinels — {{products}}
 *  and {{categories}} — resolved against the live catalogue at render time so
 *  those two figures stay dynamic whether they come from CMS or from DEFAULTS. */
export interface Stat {
  value: string;
  label: string;
}

export const STAT_SENTINEL_PRODUCTS = "{{products}}";
export const STAT_SENTINEL_CATEGORIES = "{{categories}}";

export const DEFAULT_STATS: Stat[] = [
  { value: STAT_SENTINEL_PRODUCTS, label: "Products stocked" },
  { value: STAT_SENTINEL_CATEGORIES, label: "Categories" },
  { value: "2–8°C", label: "Cold chain, logged" },
  { value: "100%", label: "Batch traceable" },
];

export const DEFAULT_STORY_PARAS: string[] = [
  "Anyone who has run a pharmacy counter in India knows the feeling — a carton arrives from the third distributor this month, the invoice doesn't match the batch, and there is no way to know how it was stored on the way. The supply chain worked, but nobody could prove it.",
  "We started Nethrasap to make the proof part of the product. One warehouse, one promise: every unit logged to its manufacturer batch on arrival, every cold-chain handover recorded, every invoice matching what's physically in the box.",
  "Today that same discipline runs a full platform — wholesale slabs for verified retailers, clinician pricing for practices and hospitals, transparent MRP for households, and negotiable quotes for bulk buying. Different buyers, one audited chain behind all of them.",
];

export interface Founder {
  name: string;
  role: string;
  line: string;
  image_url?: string;
}

export const DEFAULT_FOUNDERS: Founder[] = [
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

export interface Location {
  city: string;
  role: string;
  note: string;
}

export const DEFAULT_LOCATIONS: Location[] = [
  { city: "Chennai", role: "Headquarters · cold-chain hub", note: "Primary warehouse, QC and batch intake" },
  { city: "Coimbatore", role: "Fulfilment centre", note: "Western Tamil Nadu, next-day lanes" },
  { city: "Bengaluru", role: "Cold-chain hub", note: "Biologics and vaccine distribution" },
  { city: "Hyderabad", role: "Fulfilment centre", note: "Telangana and Andhra coverage" },
  { city: "Mumbai", role: "Fulfilment centre", note: "Western region wholesale lanes" },
  { city: "Delhi NCR", role: "Fulfilment centre", note: "Northern region coverage" },
];

export const DEFAULT_CERTS: string[] = [
  "CDSCO-verified sourcing",
  "GDP-compliant cold chain",
  "Drug licence 20B / 21B",
  "GST registered",
  "Batch-level traceability",
];

export const DEFAULT_ABOUT_CTA: CtaBand = {
  eyebrow: "Buy the audited way",
  heading: "One verified account. Every category on one invoice.",
  body: "Keep ordering at standard pricing while our team verifies your documents — nothing is blocked while you wait.",
  cta_label: "Create your account",
  cta_href: "/signup",
  alt_label: "Explore the catalogue",
  alt_href: "/products",
};

/* ---------- global ---------- */

export interface FooterLink {
  label: string;
  href?: string;
}

export interface FooterColumn {
  heading: string;
  items: FooterLink[];
}

export const DEFAULT_FOOTER_BLURB =
  "India's audited healthcare supply platform. GDP-compliant cold chain, CDSCO-verified sourcing.";

export const DEFAULT_FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Shop",
    items: [
      { label: "All products", href: "/products" },
      { label: "Categories", href: "/categories" },
      { label: "Compare", href: "/compare" },
      { label: "Track order", href: "/track" },
      { label: "About us", href: "/about" },
    ],
  },
  {
    heading: "Account",
    items: [
      { label: "Sign in", href: "/login" },
      { label: "Register as retailer / clinician", href: "/signup" },
      { label: "My orders", href: "/account" },
      { label: "Saved items", href: "/wishlist" },
    ],
  },
  {
    heading: "Buying for",
    items: [{ label: "Retail pharmacies" }, { label: "Clinicians & hospitals" }, { label: "Home care" }],
  },
];

export const DEFAULT_FOOTER_LEGAL =
  "© 2026 Nethrasap. For authorised buyers only. Not a substitute for professional medical advice.";

/** pdp_trust_badge{label,icon} — icon is an SVG path (the `d` attribute). */
export interface PdpTrustBadge {
  label: string;
  icon: string;
}

export const DEFAULT_PDP_TRUST_BADGES: PdpTrustBadge[] = [
  { label: "CDSCO-verified", icon: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2 2 4-4" },
  { label: "GDP cold chain", icon: "M12 2v20M4 6l16 12M20 6L4 18 M12 2l-2 3h4z M12 22l-2-3h4z" },
  { label: "GMP facility", icon: "M3 21V10l6 3V10l6 3V10l6 3v8z M3 21h18 M7 21v-4h3v4M14 21v-4h3v4" },
  { label: "Easy returns", icon: "M9 14L4 9l5-5 M4 9h11a5 5 0 0 1 0 10h-4" },
];

export const DEFAULT_ANNOUNCEMENT =
  "Pan-India delivery across serviceable pincodes · GDP-compliant cold chain · CDSCO-verified sourcing";
