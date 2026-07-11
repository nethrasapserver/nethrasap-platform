"use client";
import { LoginPage, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <LoginPage />
      <ToastHost />
    </></ClientOnly>);
}
