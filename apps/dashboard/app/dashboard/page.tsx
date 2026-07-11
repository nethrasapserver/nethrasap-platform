"use client";
import { PortalShell, UserDashboard, ToastHost, ChatBot } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="user" active="dashboard" breadcrumbs={[{label:"Dashboard",href:"/dashboard"}]}>
        <UserDashboard />
      </PortalShell>
      <ToastHost />
      <ChatBot />
    </></ClientOnly>);
}
