"use client";
import { PortalShell, AdminCategories, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="categories" breadcrumbs={[{label:"Admin · Categories"}]}>
        <AdminCategories />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
