"use client";
import { PortalShell, SalesOrders, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="sales" active="orders" breadcrumbs={[{label:"Sales · Orders"}]}>
        <SalesOrders />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
