"use client";
import { PortalShell, HrEmployees, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="employees" breadcrumbs={[{label:"HR · Employees"}]}>
        <HrEmployees />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
