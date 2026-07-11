"use client";
import { PortalShell, SalesOrderDetail, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="sales" active="orders" breadcrumbs={[{label:"Sales · Order"}]}>
        <SalesOrderDetail />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
