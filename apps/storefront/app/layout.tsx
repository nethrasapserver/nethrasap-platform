import type { Metadata } from "next";
import "@nethrasap/ui/styles.css";
import "@/styles/app.css";
import "@nethrasap/ui/auth.css";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { ChatBot } from "@/components/ChatBot";
import { DynamicFooter } from "@/components/DynamicFooter";
import { BottomNav, FloatingCartBar, Header, StaffBanner } from "@/components/Shell";
import { sans } from "./fonts";
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
    <html lang="en" className={sans.variable}>
      <body>
        <Providers>
          <AnnouncementBar />
          <StaffBanner />
          <Header />
          <main style={{ minHeight: "60vh" }}>{children}</main>
          <DynamicFooter />
          <BottomNav />
          <FloatingCartBar />
          <ChatBot />
        </Providers>
      </body>
    </html>
  );
}
