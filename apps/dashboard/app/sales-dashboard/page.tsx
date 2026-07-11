"use client";
import { PortalShell, SalesDashboard, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="sales" active="dashboard" breadcrumbs={[{label:"Sales · Dashboard"}]}>
        <SalesDashboard />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
