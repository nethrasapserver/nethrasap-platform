"use client";
import { PortalShell, ManagerSettings, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="manager" active="settings" breadcrumbs={[{label:"Manager · Settings"}]}>
        <ManagerSettings />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
