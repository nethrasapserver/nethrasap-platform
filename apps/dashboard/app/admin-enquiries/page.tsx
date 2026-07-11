"use client";
import { PortalShell, SalesEnquiriesList, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="enquiries" breadcrumbs={[{label:"Admin · Enquiries"}]}>
        <SalesEnquiriesList />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
