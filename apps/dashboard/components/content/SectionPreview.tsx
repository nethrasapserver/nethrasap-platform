"use client";

import { BlockPreview } from "./BlockPreview";
import { HeroSlidePreview } from "./HeroSlidePreview";

/* True-to-site previews for every CMS block kind, mirroring the storefront
   markup (apps/storefront/app/page.tsx, /about, and the global components) so
   editors see what they're editing. `icon` values are SVG path `d` strings, as
   on the site. Falls back to the generic BlockPreview for any unknown kind. */

const st = (c: Record<string, unknown>, k: string) => (typeof c[k] === "string" ? (c[k] as string).trim() : "");
const list = (c: Record<string, unknown>, k: string) => (Array.isArray(c[k]) ? (c[k] as unknown[]) : []);

/* Friendly names for section_heading / section_intro slots, so each block says
   which part of the live page it controls instead of a generic "Section intro". */
const SLOT_LABELS: Record<string, string> = {
  // home
  category: "Home · Category heading",
  featured: "Home · Featured heading",
  buyers: "Home · Buyer-cards heading",
  about: "Home · About intro",
  faq: "Home · FAQ intro",
  // about
  story: "About · Our story",
  operate: "About · How we operate",
  founders: "About · The founders",
  network: "About · Where we operate",
  network_foot: "About · Registered-office line",
  compliance: "About · Compliance note",
  principles: "About · “What we stand for”",
  // site_text
  search_placeholder: "Search box placeholder",
  buybox_shipping: "Product page · shipping line",
  buybox_tax: "Product page · tax line",
  categories_heading: "Categories page · heading",
  categories_intro: "Categories page · intro",
  seo_title: "SEO · site title",
  seo_description: "SEO · description",
  home_foot_stat_label: "Home · footer stat label",
  home_foot_stat_value: "Home · footer stat value",
  home_foot_cta_label: "Home · footer primary button",
  home_foot_cta_href: "Home · footer primary link",
  home_foot_alt_label: "Home · footer alt button",
  home_foot_alt_href: "Home · footer alt link",
};

function SlotBadge({ content }: { content: Record<string, unknown> }) {
  const slot = st(content, "slot");
  if (!slot) return null;
  return <span className="sp-slot">📍 {SLOT_LABELS[slot] ?? slot}</span>;
}

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  if (!d) return <span className="sp-ic-dot" />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Cta({ label, kindOutline }: { label: string; kindOutline?: boolean }) {
  if (!label) return null;
  return <span className={`hp-btn ${kindOutline ? "hp-btn-outline" : "hp-btn-primary"}`}>{label}</span>;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function Body({ kind, content }: { kind: string; content: Record<string, unknown> }) {
  const c = content;
  switch (kind) {
    case "hero_slide":
      return <HeroSlidePreview content={c} framed={false} />;

    case "section_heading":
      return (
        <div className="sp-slotted">
          <SlotBadge content={c} />
          <div className="sp-secheading">
            <span className="sp-h">{st(c, "heading") || "Section heading"}</span>
            {st(c, "link_label") && <span className="sp-link">{st(c, "link_label")} →</span>}
          </div>
        </div>
      );

    case "section_intro":
      return (
        <div className="sp-slotted">
          <SlotBadge content={c} />
          <div className="sp-intro">
            {st(c, "eyebrow") && <span className="sp-eyebrow">{st(c, "eyebrow")}</span>}
            <span className="sp-h">{st(c, "heading") || "Section intro"}</span>
            {st(c, "body") && <p className="sp-body">{st(c, "body")}</p>}
          </div>
        </div>
      );

    case "trust_badge":
      return (
        <div className="sp-trust">
          <span className="sp-ic sp-ic-round"><Icon d={st(c, "icon")} /></span>
          <span>
            <b className="sp-strong">{st(c, "title") || "Trust badge"}</b>
            {st(c, "subtitle") && <span className="sp-body sp-inline">{st(c, "subtitle")}</span>}
          </span>
        </div>
      );

    case "buyer_card":
      return (
        <div className="sp-buyer">
          <span className="sp-ic sp-ic-round"><Icon d={st(c, "icon")} size={20} /></span>
          <b className="sp-strong">{st(c, "title") || "Buyer card"}</b>
          {st(c, "body") && <p className="sp-body">{st(c, "body")}</p>}
          <span className="sp-link">Get started →</span>
        </div>
      );

    case "flow_step":
      return (
        <div className="sp-flow">
          <span className={`sp-flow-dot ${st(c, "image_url") ? "has-img" : ""}`}>
            {st(c, "image_url") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="sp-flow-img" src={st(c, "image_url")} alt="" />
            ) : (
              <Icon d={st(c, "icon")} size={22} />
            )}
          </span>
          <span className="sp-flow-label">
            <b className="sp-strong">{st(c, "title") || "Step"}</b>
            {st(c, "subtitle") && <span className="sp-body">{st(c, "subtitle")}</span>}
          </span>
        </div>
      );

    case "faq_item":
      return (
        <div className="sp-faq">
          <div className="sp-faq-q">
            <span className="sp-strong">{st(c, "question") || "Question"}</span>
            <span className="sp-chevron">⌄</span>
          </div>
          {st(c, "answer") && <p className="sp-body">{st(c, "answer")}</p>}
        </div>
      );

    case "cta_band":
      return (
        <div className="sp-cta">
          {st(c, "eyebrow") && <span className="sp-eyebrow sp-eyebrow-ice">{st(c, "eyebrow")}</span>}
          <span className="sp-h sp-h-lg">{st(c, "heading") || "Call to action"}</span>
          {st(c, "body") && <p className="sp-body">{st(c, "body")}</p>}
          <div className="sp-cta-actions">
            <Cta label={st(c, "cta_label")} />
            <Cta label={st(c, "alt_label")} kindOutline />
          </div>
        </div>
      );

    case "about_hero":
      return (
        <div className="sp-abhero">
          {st(c, "eyebrow") && <span className="sp-eyebrow sp-eyebrow-light">{st(c, "eyebrow")}</span>}
          <span className="sp-h sp-h-lg sp-on-dark">{st(c, "title") || "About headline"}</span>
          {st(c, "body") && <p className="sp-body sp-body-dark">{st(c, "body")}</p>}
          <div className="sp-cta-actions">
            <span className="hp-btn sp-btn-cream">{st(c, "cta_label") || "Browse products"}</span>
            {st(c, "alt_label") && <span className="hp-btn sp-btn-ghost">{st(c, "alt_label")}</span>}
          </div>
        </div>
      );

    case "stat":
      return (
        <div className="sp-stat">
          <span className="sp-stat-val">{st(c, "value") || "—"}</span>
          <span className="sp-body">{st(c, "label") || "Label"}</span>
        </div>
      );

    case "story_para":
      return <p className="sp-story">{st(c, "text") || "Story paragraph…"}</p>;

    case "principle":
      return (
        <div className={`sp-principle ${st(c, "tone") === "ice" ? "is-ice" : ""}`}>
          <span className="sp-ic sp-ic-round"><Icon d={st(c, "icon")} size={20} /></span>
          <b className="sp-strong">{st(c, "title") || "Principle"}</b>
          {st(c, "body") && <p className="sp-body">{st(c, "body")}</p>}
        </div>
      );

    case "founder":
      return (
        <div className="sp-person">
          <span className="sp-avatar">
            {st(c, "image_url") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={st(c, "image_url")} alt="" />
            ) : (
              initials(st(c, "name") || "•")
            )}
          </span>
          <b className="sp-strong">{st(c, "name") || "Name"}</b>
          {st(c, "role") && <span className="sp-role">{st(c, "role")}</span>}
          {st(c, "line") && <p className="sp-body">{st(c, "line")}</p>}
        </div>
      );

    case "location":
      return (
        <div className="sp-person">
          <span className="sp-ic sp-ic-round">
            <Icon d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z M12 10a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2z" size={18} />
          </span>
          <b className="sp-strong">{st(c, "city") || "City"}</b>
          {st(c, "role") && <span className="sp-role">{st(c, "role")}</span>}
          {st(c, "note") && <p className="sp-body">{st(c, "note")}</p>}
        </div>
      );

    case "cert":
      return (
        <span className="sp-cert">
          <Icon d="M9 12l2 2 4-5" size={14} />
          {st(c, "label") || "Certification"}
        </span>
      );

    case "announcement":
      return <div className="sp-announce">{st(c, "text") || "Announcement text"}</div>;

    case "header_nav": {
      // Seed stores either {links:[…]} or a single {label,href} per block.
      const links = list(c, "links").map((r) => (r as Record<string, unknown>)?.label).filter(Boolean) as string[];
      const labels = links.length ? links : st(c, "label") ? [st(c, "label")] : [];
      return (
        <div className="sp-nav">
          <span className="sp-nav-brand">Nethra<b>sap</b></span>
          <span className="sp-nav-links">
            {(labels.length ? labels : ["Nav link"]).map((l, i) => (
              <span className="sp-nav-link" key={i}>{l}</span>
            ))}
          </span>
        </div>
      );
    }

    case "trending": {
      // Content is either {terms:[…]} or a single {term|text|label} per block.
      const terms = list(c, "terms").filter((t): t is string => typeof t === "string" && t.trim().length > 0);
      const single = st(c, "term") || st(c, "text") || st(c, "label");
      const shown = terms.length ? terms : single ? [single] : ["Search term"];
      return (
        <div className="sp-trending">
          <span className="sp-trending-lab">Trending</span>
          {shown.map((t, i) => (
            <span className="sp-chip" key={i}>{t}</span>
          ))}
        </div>
      );
    }

    case "footer_blurb":
      return (
        <div className="sp-footer">
          <span className="sp-footer-brand">Nethra<b>sap</b></span>
          <p className="sp-footer-text">{st(c, "text") || "Footer blurb…"}</p>
        </div>
      );

    case "footer_column": {
      const items = list(c, "items")
        .map((r) => (r as Record<string, unknown>)?.label)
        .filter((l): l is string => typeof l === "string" && l.trim().length > 0);
      return (
        <div className="sp-footer sp-fcol">
          <h4 className="sp-footer-h">{st(c, "heading") || "Column"}</h4>
          <div className="sp-fcol-links">
            {(items.length ? items : ["Link"]).map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        </div>
      );
    }

    case "footer_legal":
      return <div className="sp-footer sp-flegal">{st(c, "text") || "© Company · legal line"}</div>;

    case "site_text":
      return (
        <div className="sp-slotted">
          <SlotBadge content={c} />
          <p className="sp-body" style={{ color: "var(--ink)", fontSize: ".9rem" }}>{st(c, "value") || "—"}</p>
        </div>
      );

    case "pdp_trust_badge":
      return (
        <div className="sp-pdpbadge">
          <span className="sp-ic"><Icon d={st(c, "icon")} size={22} /></span>
          <span className="sp-strong">{st(c, "label") || "Badge"}</span>
        </div>
      );

    default:
      return <BlockPreview kind={kind} content={c} />;
  }
}

export function SectionPreview({
  kind,
  content,
  framed = false,
}: {
  kind: string;
  content: Record<string, unknown>;
  framed?: boolean;
}) {
  // Hero already ships a full framed treatment of its own.
  if (kind === "hero_slide") return <HeroSlidePreview content={content} framed={framed} />;
  return <div className={`sp ${framed ? "sp-framed" : ""}`}><Body kind={kind} content={content} /></div>;
}
