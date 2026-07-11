"use client";
import { PortalShell, UserOrderDetail, ToastHost, ChatBot } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="user" active="orders" breadcrumbs={[{label:"Order detail"}]}>
        <UserOrderDetail />
      </PortalShell>
      <ToastHost />
      <ChatBot />
    </></ClientOnly>);
}
