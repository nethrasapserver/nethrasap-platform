"use client";
import { PortalShell, AdminProductNew, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="products" breadcrumbs={[{label:"Admin · New product"}]}>
        <AdminProductNew />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
