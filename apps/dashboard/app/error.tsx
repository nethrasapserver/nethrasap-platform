"use client";
import { GlobalErrorPage, ToastHost } from "@/components/legacy";

export default function ErrorBoundary() {
  return (
    <>
      <GlobalErrorPage />
      <ToastHost />
    </>
  );
}
