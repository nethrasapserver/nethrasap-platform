"use client";
import { PortalShell, HrAttendance, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="admin" active="leave" breadcrumbs={[{label:"HR · Attendance"}]}>
        <HrAttendance />
      </PortalShell>
      <ToastHost />
    </></ClientOnly>);
}
