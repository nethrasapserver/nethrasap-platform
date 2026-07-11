"use client";
import { PortalShell, SalesVerifications, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="manager" active="verifications" breadcrumbs={[{label:"Manager · Verifications"}]}>
        <SalesVerifications />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
