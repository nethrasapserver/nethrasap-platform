"use client";
import { PortalShell, AdminCms, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="cms" breadcrumbs={[{label:"Admin · CMS"}]}>
        <AdminCms />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
