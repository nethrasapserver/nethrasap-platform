import type { Metadata } from "next";
import "@nethrasap/ui/styles.css";
import "@nethrasap/ui/portal.css";
import "./globals.css";
// After globals: auth sizing (.btn-lg) must win over the dense dashboard .btn.
import "@nethrasap/ui/auth.css";
import { sans } from "./fonts";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Nethrasap Ops",
  description: "Nethrasap operations dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
