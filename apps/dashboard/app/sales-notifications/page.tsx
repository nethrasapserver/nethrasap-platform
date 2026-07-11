"use client";
import { PortalShell, SalesNotifications, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="sales" active="notifications" breadcrumbs={[{label:"Sales · Notifications"}]}>
        <SalesNotifications />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
