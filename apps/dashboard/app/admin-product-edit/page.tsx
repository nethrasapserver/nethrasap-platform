"use client";
import { PortalShell, AdminProductEdit, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="products" breadcrumbs={[{label:"Admin · Edit product"}]}>
        <AdminProductEdit />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
