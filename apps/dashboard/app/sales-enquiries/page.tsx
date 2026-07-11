"use client";
import { PortalShell, SalesEnquiriesList, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="sales" active="enquiries" breadcrumbs={[{label:"Sales · Enquiries"}]}>
        <SalesEnquiriesList />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
