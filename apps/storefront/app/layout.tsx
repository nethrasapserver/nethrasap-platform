import type { Metadata } from "next";
import "@nethrasap/ui/styles.css";
import "@/styles/app.css";
import "@nethrasap/ui/auth.css";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { ChatBot } from "@/components/ChatBot";
import { DynamicFooter } from "@/components/DynamicFooter";
import { BottomNav, FloatingCartBar, StaffBanner } from "@/components/Shell";
import { SiteHeader } from "@/components/SiteHeader";
import { getPage, siteText } from "@/lib/content";
import { sans } from "./fonts";
import Providers from "./providers";

export async function generateMetadata(): Promise<Metadata> {
  const g = await getPage("global");
  return {
    title: {
      default: siteText(g, "seo_title"),
      template: "%s | Nethrasap",
    },
    description: siteText(g, "seo_description"),
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <Providers>
          <AnnouncementBar />
          <StaffBanner />
          <SiteHeader />
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
