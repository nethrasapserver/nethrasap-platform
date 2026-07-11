"use client";
import { PortalShell, AdminOrderDetail, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="orders" breadcrumbs={[{label:"Admin · Order"}]}>
        <AdminOrderDetail />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
