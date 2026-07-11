"use client";
import { PortalShell, SalesVerifications, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="sales" active="verifications" breadcrumbs={[{label:"Sales · Verifications"}]}>
        <SalesVerifications />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
