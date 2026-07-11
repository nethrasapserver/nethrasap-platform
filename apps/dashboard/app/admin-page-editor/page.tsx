"use client";
import { PortalShell, AdminPageEditor, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="cms" breadcrumbs={[{label:"Admin · Page editor"}]}>
        <AdminPageEditor />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
