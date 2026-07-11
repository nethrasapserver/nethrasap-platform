"use client";
import { PortalShell, ManagerTeam, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="manager" active="team" breadcrumbs={[{label:"Manager · Team"}]}>
        <ManagerTeam />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
