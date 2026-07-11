"use client";
import { PortalShell, SalesEnquiriesList, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="manager" active="enquiries" breadcrumbs={[{label:"Manager · Enquiries"}]}>
        <SalesEnquiriesList />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
