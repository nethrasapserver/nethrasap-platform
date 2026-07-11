"use client";
import { PortalShell, HrLeave, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="leave" breadcrumbs={[{label:"HR · Leave"}]}>
        <HrLeave />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
