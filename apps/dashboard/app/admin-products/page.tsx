"use client";
import { PortalShell, AdminProducts, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="products" breadcrumbs={[{label:"Admin · Products"}]}>
        <AdminProducts />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
