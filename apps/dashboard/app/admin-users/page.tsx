"use client";
import { PortalShell, AdminUsers, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="users" breadcrumbs={[{label:"Admin · Users"}]}>
        <AdminUsers />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
