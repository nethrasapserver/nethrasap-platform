"use client";
import { PortalShell, UserOrdersList, ToastHost, ChatBot } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="user" active="orders" breadcrumbs={[{label:"My orders"}]}>
        <UserOrdersList />
      </PortalShell>
      <ToastHost />
      <ChatBot />
    </></ClientOnly>);
}
