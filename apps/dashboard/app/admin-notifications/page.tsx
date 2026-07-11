"use client";
import { PortalShell, SalesNotifications, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="notifications" breadcrumbs={[{label:"Admin · Notifications"}]}>
        <SalesNotifications />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
