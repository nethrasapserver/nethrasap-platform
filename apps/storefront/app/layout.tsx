import type { Metadata } from "next";
import "@/styles/styles.css";
import "@/styles/sections.css";
import "@/styles/pages.css";
import "@/styles/mobile.css";
import "@/styles/animations.css";
import "@/styles/tooltips.css";
import "@/styles/auth.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Nethrasap — India's audited healthcare supply platform",
    template: "%s | Nethrasap",
  },
  description:
    "Wholesale and retail pharmaceutical & healthcare supplies for clinicians, retailers and consumers across India.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
