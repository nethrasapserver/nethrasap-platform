"use client";
import { PortalShell, AdminEnquiryDetail, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="enquiries" breadcrumbs={[{label:"Admin · Enquiry"}]}>
        <AdminEnquiryDetail />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
