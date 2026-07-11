"use client";
import { PortalShell, SalesProductsPerformance, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="sales" active="products" breadcrumbs={[{label:"Sales · Products"}]}>
        <SalesProductsPerformance />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
