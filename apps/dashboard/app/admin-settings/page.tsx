"use client";
import { PortalShell, AdminSettings, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="settings" breadcrumbs={[{label:"Admin · Settings"}]}>
        <AdminSettings />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
