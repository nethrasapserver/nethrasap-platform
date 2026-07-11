"use client";
import { PortalShell, UserEnquiryDetail, ToastHost, ChatBot } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="user" active="enquiries" breadcrumbs={[{label:"Enquiry detail"}]}>
        <UserEnquiryDetail />
      </PortalShell>
      <ToastHost />
      <ChatBot />
    </></ClientOnly>);
}
