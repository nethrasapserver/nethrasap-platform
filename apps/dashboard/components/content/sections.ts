/** Page sections — the editor's structure mirrors the live page.
 *
 * The CMS stores blocks by `kind`, and headings/intros additionally carry a
 * `slot` naming which part of the page they replace. Editors shouldn't have to
 * know either: they think in sections ("the FAQ", "the hero"). This map turns
 * kind+slot into the sections you actually see on the site, in render order.
 *
 * Each section owns one or more PARTS. A `single` part is a one-off (the
 * section's heading, its intro, the hero of a page); everything else is a list
 * you add to, reorder and hide.
 */

export interface SectionPart {
  kind: string;
  /** Restricts the part to blocks whose content.slot matches (headings/intros). */
  slot?: string;
  /** One block, not a list — renders Edit/Add instead of list controls. */
  single?: boolean;
  /** Overrides the kind's default label for this part. */
  label?: string;
  help?: string;
}

export interface PageSection {
  id: string;
  title: string;
  help: string;
  parts: SectionPart[];
}

export const SURFACE_SECTIONS: Record<string, PageSection[]> = {
  home: [
    {
      id: "hero",
      title: "Hero banner",
      help: "The rotating banners at the very top of the home page.",
      parts: [{ kind: "hero_slide", label: "Slides" }],
    },
    {
      id: "trust",
      title: "Trust strip",
      help: "The reassurance row directly under the hero.",
      parts: [{ kind: "trust_badge", label: "Badges" }],
    },
    {
      id: "categories",
      title: "Shop by category",
      help: "The category rail. Products come from the catalogue — only the heading is editable here.",
      parts: [{ kind: "section_heading", slot: "category", single: true, label: "Heading" }],
    },
    {
      id: "featured",
      title: "Featured products",
      help: "The featured shelf. Products come from the catalogue — only the heading is editable here.",
      parts: [{ kind: "section_heading", slot: "featured", single: true, label: "Heading" }],
    },
    {
      id: "buyers",
      title: "Who buys on Nethrasap",
      help: "Buyer-segment cards and the heading above them.",
      parts: [
        { kind: "section_heading", slot: "buyers", single: true, label: "Heading" },
        { kind: "buyer_card", label: "Buyer cards" },
      ],
    },
    {
      id: "about",
      title: "How it works",
      help: "The supply-chain journey: intro copy plus the numbered steps.",
      parts: [
        { kind: "section_intro", slot: "about", single: true, label: "Intro" },
        { kind: "flow_step", label: "Steps" },
      ],
    },
    {
      id: "faq",
      title: "FAQ",
      help: "Frequently asked questions and the intro above them.",
      parts: [
        { kind: "section_intro", slot: "faq", single: true, label: "Intro" },
        { kind: "faq_item", label: "Questions" },
      ],
    },
    {
      id: "cta",
      title: "Closing call to action",
      help: "The dark band at the bottom of the page.",
      parts: [{ kind: "cta_band", single: true, label: "CTA band" }],
    },
    {
      id: "text",
      title: "Other text on this page",
      help: "Reusable strings used across the page, keyed by slot.",
      parts: [{ kind: "site_text", label: "Text entries" }],
    },
  ],

  about: [
    {
      id: "hero",
      title: "Page hero",
      help: "The header at the top of the About page.",
      parts: [{ kind: "about_hero", single: true, label: "Hero" }],
    },
    {
      id: "stats",
      title: "Stats strip",
      help: "Headline numbers under the hero.",
      parts: [{ kind: "stat", label: "Stats" }],
    },
    {
      id: "story",
      title: "Our story",
      help: "The company story: intro plus paragraphs.",
      parts: [
        { kind: "section_intro", slot: "story", single: true, label: "Intro" },
        { kind: "story_para", label: "Paragraphs" },
      ],
    },
    {
      id: "principles",
      title: "Principles",
      help: "The values cards and their heading.",
      parts: [
        { kind: "section_heading", slot: "principles", single: true, label: "Heading" },
        { kind: "principle", label: "Principles" },
      ],
    },
    {
      id: "operate",
      title: "How we operate",
      help: "The operating flow: intro plus numbered steps.",
      parts: [
        { kind: "section_intro", slot: "operate", single: true, label: "Intro" },
        { kind: "flow_step", label: "Steps" },
      ],
    },
    {
      id: "founders",
      title: "Team",
      help: "Founder and team profiles.",
      parts: [
        { kind: "section_intro", slot: "founders", single: true, label: "Intro" },
        { kind: "founder", label: "People" },
      ],
    },
    {
      id: "network",
      title: "Network",
      help: "The cities you operate in, with intro and footnote.",
      parts: [
        { kind: "section_intro", slot: "network", single: true, label: "Intro" },
        { kind: "location", label: "Locations" },
        { kind: "section_intro", slot: "network_foot", single: true, label: "Footnote" },
      ],
    },
    {
      id: "compliance",
      title: "Compliance",
      help: "Certification chips and the copy around them.",
      parts: [
        { kind: "section_intro", slot: "compliance", single: true, label: "Intro" },
        { kind: "cert", label: "Certifications" },
      ],
    },
    {
      id: "cta",
      title: "Closing call to action",
      help: "The band at the bottom of the About page.",
      parts: [{ kind: "cta_band", single: true, label: "CTA band" }],
    },
  ],

  global: [
    {
      id: "logo",
      title: "Brand logo",
      help: "The wordmark or logo image in the site header.",
      parts: [{ kind: "site_logo", single: true, label: "Logo" }],
    },
    {
      id: "announcement",
      title: "Announcement bar",
      help: "The thin bar at the very top of every page.",
      parts: [{ kind: "announcement", label: "Messages" }],
    },
    {
      id: "header",
      title: "Header",
      help: "Navigation links and the search box's trending terms.",
      parts: [
        { kind: "header_nav", label: "Nav links" },
        { kind: "trending", single: true, label: "Trending terms" },
      ],
    },
    {
      id: "footer",
      title: "Footer",
      help: "The blurb, link columns and legal line at the bottom of every page.",
      parts: [
        { kind: "footer_blurb", single: true, label: "Blurb" },
        { kind: "footer_column", label: "Link columns" },
        { kind: "footer_legal", single: true, label: "Legal line" },
      ],
    },
    {
      id: "pdp",
      title: "Product pages",
      help: "Trust badges shown on every product detail page.",
      parts: [{ kind: "pdp_trust_badge", label: "Trust badges" }],
    },
    {
      id: "text",
      title: "Site text",
      help: "Reusable strings across the site — search box, shipping lines, SEO title — keyed by slot.",
      parts: [{ kind: "site_text", label: "Text entries" }],
    },
  ],
};

/** Every (kind, slot) pair a surface's sections claim — used to find orphans. */
export function claimedKeys(slug: string): Set<string> {
  const out = new Set<string>();
  for (const section of SURFACE_SECTIONS[slug] ?? []) {
    for (const part of section.parts) out.add(part.slot ? `${part.kind}:${part.slot}` : part.kind);
  }
  return out;
}
