"use client";
import { PortalShell, SalesNotifications, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="manager" active="notifications" breadcrumbs={[{label:"Manager · Notifications"}]}>
        <SalesNotifications />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
