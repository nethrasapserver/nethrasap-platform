import localFont from "next/font/local";

// Self-hosted variable font (packages/ui/fonts) — no CDN request at runtime.
// One family everywhere (owner decision): Plus Jakarta Sans carries UI,
// display AND data text; data keeps its uppercase/tracking/tabular treatments.
export const sans = localFont({
  src: "../../../packages/ui/fonts/PlusJakartaSans.woff2",
  weight: "200 800",
  variable: "--font-sans",
  display: "swap",
});
