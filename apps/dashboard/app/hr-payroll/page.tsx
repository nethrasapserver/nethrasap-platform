"use client";
import { PortalShell, HrPayroll, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="payroll" breadcrumbs={[{label:"HR · Payroll"}]}>
        <HrPayroll />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
