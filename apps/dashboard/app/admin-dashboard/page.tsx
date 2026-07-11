"use client";
import { PortalShell, AdminDashboard, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="dashboard" breadcrumbs={[{label:"Admin · Dashboard"}]}>
        <AdminDashboard />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
