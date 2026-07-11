"use client";
import { PortalShell, SalesTeamSimple, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="sales" active="team" breadcrumbs={[{label:"Sales · Team"}]}>
        <SalesTeamSimple />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
