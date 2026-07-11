"use client";
import { PortalShell, ManagerAnalytics, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="manager" active="analytics" breadcrumbs={[{label:"Manager · Analytics"}]}>
        <ManagerAnalytics />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
