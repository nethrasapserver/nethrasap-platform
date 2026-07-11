"use client";
import { PortalShell, HrHolidays, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="holidays" breadcrumbs={[{label:"HR · Holidays"}]}>
        <HrHolidays />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
