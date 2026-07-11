import type { Metadata } from "next";
import "@/styles/app.css";
import { Footer, Header } from "@/components/Shell";
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
        <Providers>
          <Header />
          <main style={{ minHeight: "60vh" }}>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
