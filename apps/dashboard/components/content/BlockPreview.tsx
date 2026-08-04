"use client";

import { FIELDS, type LinkRow } from "./BlockForm";

/* A visual preview of a CMS block that mirrors how it reads on the live site —
   image/theme on the left, the headline and supporting copy, then chips for
   CTAs, links, terms and tags. Driven generically off the field registry so
   every block kind gets a sensible preview without a bespoke component. */

const CTA_PAIRS: [string, string][] = [
  ["cta_label", "cta_href"],
  ["alt_label", "alt_href"],
  ["primary_label", "primary_href"],
  ["secondary_label", "secondary_href"],
  ["link_label", "link_href"],
];

const THEME_HEX: Record<string, string> = {
  olive: "#606c38",
  cream: "#fefae0",
  ice: "#e6eef2",
  clay: "#cf7b56",
};

export function BlockPreview({ kind, content }: { kind: string; content: Record<string, unknown> }) {
  const s = (k: string) => (typeof content[k] === "string" ? (content[k] as string).trim() : "");
  const arr = (k: string) => (Array.isArray(content[k]) ? (content[k] as unknown[]) : []);

  const imageField = (FIELDS[kind] ?? []).find((f) => f.type === "image" && s(f.key));
  const imageUrl = imageField ? s(imageField.key) : "";

  const eyebrow = s("eyebrow") || s("slot");
  const primary =
    s("title") || s("heading") || s("question") || s("name") || s("value") || s("city") || s("label") || s("text");
  const secondary = s("body") || s("answer") || s("subtitle") || s("note") || s("line") || s("role");
  const swatch = s("theme") || s("tone");
  const icon = s("icon");

  const ctas = CTA_PAIRS.map(([lk, hk]) => ({ label: s(lk), href: s(hk) })).filter((c) => c.label || c.href);

  const linkRows = [...arr("links"), ...arr("items")]
    .filter((r): r is LinkRow => !!r && typeof r === "object")
    .map((r) => r.label || r.href)
    .filter(Boolean);
  const terms = arr("terms").filter((t): t is string => typeof t === "string" && t.trim().length > 0);

  const hasMeta = ctas.length > 0 || linkRows.length > 0 || terms.length > 0;

  return (
    <div className="cms-prev">
      {imageUrl ? (
        <span className="cms-prev-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" />
        </span>
      ) : swatch ? (
        <span className="cms-prev-swatch" style={{ background: THEME_HEX[swatch] ?? "var(--paper-3)" }} title={swatch} />
      ) : icon ? (
        <span className="cms-prev-glyph">{icon.length <= 3 ? icon : icon.slice(0, 2).toUpperCase()}</span>
      ) : null}

      <div className="cms-prev-body">
        {eyebrow && <span className="cms-prev-eyebrow">{eyebrow}</span>}
        {primary && <div className="cms-prev-title">{primary}</div>}
        {secondary && <p className="cms-prev-sub">{secondary}</p>}
        {hasMeta && (
          <div className="cms-prev-meta">
            {ctas.map((c, i) => (
              <span className="cms-chip cms-chip-btn" key={`c${i}`}>
                {c.label || "Button"}
                {c.href && <em>{c.href}</em>}
              </span>
            ))}
            {linkRows.map((l, i) => (
              <span className="cms-chip" key={`l${i}`}>
                {l}
              </span>
            ))}
            {terms.map((t, i) => (
              <span className="cms-chip" key={`t${i}`}>
                {t}
              </span>
            ))}
          </div>
        )}
        {!primary && !secondary && !hasMeta && <span className="muted small">Empty — click Edit to add content.</span>}
      </div>
    </div>
  );
}
