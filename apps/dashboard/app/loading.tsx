import { PageSkeleton } from "@/components/PageSkeleton";

/** Root-level route fallback — no portal chrome at this depth, so give the
    skeleton the same ground and padding the portal body would. */
export default function RootLoading() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--paper)", padding: "var(--sp-6)" }}>
      <PageSkeleton />
    </main>
  );
}
