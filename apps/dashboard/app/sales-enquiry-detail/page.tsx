"use client";
import { PortalShell, SalesEnquiryDetail, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="sales" active="enquiries" breadcrumbs={[{label:"Sales · Enquiry"}]}>
        <SalesEnquiryDetail />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
