"use client";
import { PolicyPage, ToastHost, PageShell, ChatBot } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PageShell active="legal" hideMobileNav>
      <PolicyPage kind="privacy" />
      </PageShell>
      <ToastHost />
      <ChatBot />
    </></ClientOnly>);
}
