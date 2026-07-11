"use client";
import { PortalShell, VerificationDetail, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="sales" active="verifications" breadcrumbs={[{label:"Verification detail"}]}>
        <VerificationDetail />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
