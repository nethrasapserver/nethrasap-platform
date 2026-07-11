"use client";
import { PortalShell, SalesCustomers, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="sales" active="customers" breadcrumbs={[{label:"Sales · Customers"}]}>
        <SalesCustomers />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
