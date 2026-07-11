"use client";
import { PortalShell, SalesReports, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="sales" active="reports" breadcrumbs={[{label:"Sales · Reports"}]}>
        <SalesReports />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
