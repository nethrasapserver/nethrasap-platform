"use client";
import { PortalShell, ManagerDashboard, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="manager" active="dashboard" breadcrumbs={[{label:"Manager · Dashboard"}]}>
        <ManagerDashboard />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
