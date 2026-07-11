"use client";
import { PortalShell, ManagerOrders, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="manager" active="orders" breadcrumbs={[{label:"Manager · Orders"}]}>
        <ManagerOrders />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
