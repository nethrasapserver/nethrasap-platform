"use client";
import { PortalShell, AdminOrders, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="orders" breadcrumbs={[{label:"Admin · Orders"}]}>
        <AdminOrders />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
