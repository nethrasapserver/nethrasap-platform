"use client";
import { SignupPage, ToastHost } from "@/components/legacy";
import ClientOnly from "@/components/ClientOnly";

export default function Page() {
  return (
    <ClientOnly><>
      <SignupPage />
      <ToastHost />
    </></ClientOnly>);
}
