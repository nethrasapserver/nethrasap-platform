import type { Metadata } from "next";
import Script from "next/script";
import "../styles/styles.css";
import "../styles/sections.css";
import "../styles/pages.css";
import "../styles/mobile.css";
import "../styles/animations.css";
import "../styles/tooltips.css";
import "../styles/chatbot.css";
import "../styles/auth.css";
import "../styles/portal.css";

export const metadata: Metadata = {
  title: "Nethrasap — India's audited healthcare supply platform",
  description:
    "Verified manufacturers, bonded warehouses, transparent pricing — the supply backbone for India's pharmacies, clinics and hospitals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Legacy IIFE data bundles — populate window.NETHRA_DATA / NETHRA_PORTAL.
           They contain no JSX and don't need React. Icons & IMG are now real TS modules. */}
        <Script src="/legacy/data.js" strategy="beforeInteractive" />
        <Script src="/legacy/data-portal.js" strategy="beforeInteractive" />
        <Script src="/legacy/tooltips.js" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
