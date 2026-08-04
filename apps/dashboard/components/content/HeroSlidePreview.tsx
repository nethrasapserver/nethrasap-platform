"use client";

/* A faithful, editor-side rendering of a storefront hero slide (mirrors
   apps/storefront/components/HeroCarousel.tsx): eyebrow, big headline, body,
   the two CTA buttons and the theme-keyed illustration. Shown live in the
   block editor so staff see exactly what a slide will look like as they type. */

type Theme = "olive" | "cream" | "ice";
const THEMES = new Set<Theme>(["olive", "cream", "ice"]);
const normTheme = (t: unknown): Theme => (typeof t === "string" && THEMES.has(t as Theme) ? (t as Theme) : "olive");

const ART_COLOR: Record<Theme, string> = { olive: "var(--brand-600)", cream: "var(--copper)", ice: "#2b6b7f" };
const EYEBROW_COLOR: Record<Theme, string> = { olive: "var(--brand-700)", cream: "var(--brand-700)", ice: "#2b6b7f" };

/* Ported verbatim from the storefront so the placeholder art matches the site. */
function ThemeArt({ theme }: { theme: Theme }) {
  const p = {
    width: "100%",
    height: "100%",
    viewBox: "0 0 200 160",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (theme === "cream") {
    return (
      <svg {...p}>
        <path d="M30 120V84M66 120V60M102 120V72M138 120V44M174 120V96" opacity=".45" />
        <path d="M24 128h156" />
        <path d="M30 84l36-24 36 12 36-28 36 26" />
        <circle cx="138" cy="44" r="7" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (theme === "ice") {
    return (
      <svg {...p}>
        <rect x="82" y="32" width="46" height="46" rx="12" fill="currentColor" opacity=".13" stroke="none" />
        <rect x="28" y="86" width="46" height="46" rx="12" fill="currentColor" opacity=".13" stroke="none" />
        <rect x="28" y="32" width="46" height="46" rx="12" />
        <rect x="82" y="32" width="46" height="46" rx="12" />
        <rect x="136" y="32" width="46" height="46" rx="12" />
        <rect x="28" y="86" width="46" height="46" rx="12" />
        <rect x="82" y="86" width="46" height="46" rx="12" />
        <rect x="136" y="86" width="46" height="46" rx="12" />
        <rect x="44" y="49" width="14" height="12" rx="6" />
        <path d="M159 45v10M154 55h10v14a4 4 0 01-4 4h-2a4 4 0 01-4-4z" />
      </svg>
    );
  }
  return (
    <svg {...p}>
      <path d="M18 108h34l10-40h84l10 40h26" opacity=".35" />
      <rect x="52" y="52" width="72" height="56" rx="6" />
      <path d="M124 70h22l16 22v16h-38z" />
      <circle cx="74" cy="118" r="10" />
      <circle cx="146" cy="118" r="10" />
      <path d="M74 66v20M64 76h20" />
    </svg>
  );
}

export function HeroSlidePreview({ content, framed = true }: { content: Record<string, unknown>; framed?: boolean }) {
  const s = (k: string) => (typeof content[k] === "string" ? (content[k] as string).trim() : "");
  const theme = normTheme(content.theme);
  const eyebrow = s("eyebrow");
  const title = s("title");
  const body = s("body");
  const cta = s("cta_label");
  const alt = s("alt_label");
  const image = s("image_url");

  return (
    <div className={`hp-slide ${framed ? "hp-framed" : ""}`}>
      <div className="hp-copy">
        {eyebrow && (
          <span className="hp-eyebrow" style={{ color: EYEBROW_COLOR[theme] }}>
            {eyebrow}
          </span>
        )}
        <div className="hp-title">{title || "Slide headline"}</div>
        {body && <p className="hp-body">{body}</p>}
        <div className="hp-cta">
          {cta && <span className="hp-btn hp-btn-primary">{cta}</span>}
          {alt && <span className="hp-btn hp-btn-outline">{alt}</span>}
        </div>
      </div>
      <div className="hp-art" style={{ color: ART_COLOR[theme] }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" />
        ) : (
          <ThemeArt theme={theme} />
        )}
      </div>
    </div>
  );
}
