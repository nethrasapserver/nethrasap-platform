"use client";
import { ForgotPage, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <ForgotPage />
      <ToastHost />
    </></ClientOnly>);
}
