"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_HERO_SLIDES, type HeroSlideData, type HeroTheme } from "@/lib/content";

const ART_BOX = { width: "100%", height: "100%", viewBox: "0 0 200 160", fill: "none" } as const;

/* Theme-keyed decorative art. Used when a slide has no image_url — each theme
   keeps its original illustration so a CMS-driven slide that only sets copy
   still looks exactly like the hand-built defaults. */
function themeArt(theme: HeroTheme): React.ReactNode {
  switch (theme) {
    case "cream":
      return (
        <svg {...ART_BOX} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M30 120V84M66 120V60M102 120V72M138 120V44M174 120V96" opacity=".45" />
          <path d="M24 128h156" />
          <path d="M30 84l36-24 36 12 36-28 36 26" />
          <circle cx="138" cy="44" r="7" fill="currentColor" stroke="none" />
        </svg>
      );
    case "ice":
      return (
        <svg {...ART_BOX} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {/* A shelf of category tiles: two tinted, the rest outlined. */}
          <rect x="82" y="32" width="46" height="46" rx="12" fill="currentColor" opacity=".13" stroke="none" />
          <rect x="28" y="86" width="46" height="46" rx="12" fill="currentColor" opacity=".13" stroke="none" />
          <rect x="28" y="32" width="46" height="46" rx="12" />
          <rect x="82" y="32" width="46" height="46" rx="12" />
          <rect x="136" y="32" width="46" height="46" rx="12" />
          <rect x="28" y="86" width="46" height="46" rx="12" />
          <rect x="82" y="86" width="46" height="46" rx="12" />
          <rect x="136" y="86" width="46" height="46" rx="12" />
          {/* One capsule and one vial, so it reads as pharmacy stock. */}
          <rect x="44" y="49" width="14" height="12" rx="6" />
          <path d="M159 45v10M154 55h10v14a4 4 0 01-4 4h-2a4 4 0 01-4-4z" />
        </svg>
      );
    case "olive":
    default:
      return (
        <svg {...ART_BOX} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 108h34l10-40h84l10 40h26" opacity=".35" />
          <rect x="52" y="52" width="72" height="56" rx="6" />
          <path d="M124 70h22l16 22v16h-38z" />
          <circle cx="74" cy="118" r="10" />
          <circle cx="146" cy="118" r="10" />
          <path d="M74 66v20M64 76h20" />
        </svg>
      );
  }
}

const INTERVAL = 6500;
const THEMES: ReadonlySet<HeroTheme> = new Set<HeroTheme>(["olive", "cream", "ice"]);
const normTheme = (t: string): HeroTheme => (THEMES.has(t as HeroTheme) ? (t as HeroTheme) : "olive");

export function HeroCarousel({ slides }: { slides?: HeroSlideData[] }) {
  const data = slides && slides.length > 0 ? slides : DEFAULT_HERO_SLIDES;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = data.length;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (paused) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => go(index + 1), INTERVAL);
    return () => clearTimeout(t);
  }, [index, paused, go]);

  return (
    <section
      className="hero-carousel"
      aria-roledescription="carousel"
      aria-label="Nethrasap highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 45) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className="hero-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {data.map((s, i) => {
          const theme = normTheme(s.theme);
          const hasBg = Boolean(s.image_url);
          return (
            <div
              key={s.key || `${i}`}
              className={`hero-slide is-${theme}${hasBg ? " is-bg" : ""}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== index}
            >
              {hasBg && (
                <div className="hero-bg" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image_url} alt="" />
                </div>
              )}
              <div className="container hero-slide-inner">
                <div className="hero-copy">
                  <span className="eyebrow">{s.eyebrow}</span>
                  <h1>{s.title}</h1>
                  <p>{s.body}</p>
                  <div className="row" style={{ flexWrap: "wrap", marginTop: 6 }}>
                    <Link href={s.cta_href} className="btn btn-primary" tabIndex={i === index ? 0 : -1}>
                      {s.cta_label}
                    </Link>
                    {s.alt_label && s.alt_href && (
                      <Link href={s.alt_href} className="btn btn-outline" tabIndex={i === index ? 0 : -1}>
                        {s.alt_label}
                      </Link>
                    )}
                  </div>
                </div>
                {!hasBg && (
                  <div className="hero-art" aria-hidden="true">
                    {themeArt(theme)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" className="hero-arrow is-prev" onClick={() => go(index - 1)} aria-label="Previous slide">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <button type="button" className="hero-arrow is-next" onClick={() => go(index + 1)} aria-label="Next slide">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </button>

      <div className="hero-dots" role="tablist" aria-label="Choose slide">
        {data.map((s, i) => (
          <button
            key={s.key || `${i}`}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Slide ${i + 1}: ${s.eyebrow}`}
            className={i === index ? "on" : ""}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </section>
  );
}
