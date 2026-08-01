import { DEFAULT_PDP_TRUST_BADGES, type PdpTrustBadge } from "@/lib/content";

/* Four white trust cards under the buy box. Icons and labels originate from the
   owner-approved mockup (docs/mockups/pdp-sample.html) and are kept as the
   DEFAULTS in lib/content. When the caller passes CMS-sourced badges
   (global/pdp_trust_badge), they render instead; otherwise the original static
   set renders unchanged. Server component; pure markup.

   `icon` is an SVG path string (the `d` attribute); multi-segment defaults keep
   their original two-path look by concatenating both `d` values into one. */
export function TrustBadges({ badges }: { badges?: PdpTrustBadge[] }) {
  const items = badges && badges.length > 0 ? badges : DEFAULT_PDP_TRUST_BADGES;
  return (
    <div className="trust-grid" aria-label="Quality assurances">
      {items.map((b) => (
        <div key={b.label}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={b.icon} />
          </svg>
          {b.label}
        </div>
      ))}
    </div>
  );
}
