"use client";
import { PortalShell, ManagerPerformance, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="manager" active="performance" breadcrumbs={[{label:"Manager · Performance"}]}>
        <ManagerPerformance />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
