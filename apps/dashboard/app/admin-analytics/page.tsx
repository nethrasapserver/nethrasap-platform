"use client";
import { PortalShell, AdminAnalytics, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="analytics" breadcrumbs={[{label:"Admin · Analytics"}]}>
        <AdminAnalytics />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
