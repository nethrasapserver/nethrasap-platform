"use client";
import { PortalShell, UserAddresses, ToastHost, ChatBot } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="user" active="addresses" breadcrumbs={[{label:"Dashboard",href:"/dashboard"},{label:"Addresses"}]}>
        <UserAddresses />
      </PortalShell>
      <ToastHost />
      <ChatBot />
    </></ClientOnly>);
}
