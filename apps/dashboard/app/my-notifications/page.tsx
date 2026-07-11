"use client";
import { PortalShell, UserNotifications, ToastHost, ChatBot } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <PortalShell portal="user" active="notifications" breadcrumbs={[{label:"Notifications"}]}>
        <UserNotifications />
      </PortalShell>
      <ToastHost />
      <ChatBot />
    </></ClientOnly>);
}
