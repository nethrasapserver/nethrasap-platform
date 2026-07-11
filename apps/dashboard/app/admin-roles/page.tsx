"use client";
import { PortalShell, AdminRoles, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="roles" breadcrumbs={[{label:"Admin · Roles"}]}>
        <AdminRoles />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
