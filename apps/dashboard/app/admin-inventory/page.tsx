"use client";
import { PortalShell, AdminInventory, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="inventory" breadcrumbs={[{label:"Admin · Inventory"}]}>
        <AdminInventory />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
