"use client";
import { PortalShell, UserEnquiries, ToastHost, ChatBot } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="user" active="enquiries" breadcrumbs={[{label:"My enquiries"}]}>
        <UserEnquiries />
      </PortalShell>
      <ToastHost />
      <ChatBot />
    </></ClientOnly>);
}
