"use client";
import { OfflinePage, ToastHost, PageShell, ChatBot } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PageShell active="legal" hideMobileNav>
      <OfflinePage />
      </PageShell>
      <ToastHost />
      <ChatBot />
    </></ClientOnly>);
}
