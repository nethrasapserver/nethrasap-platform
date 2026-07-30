import { PageSkeleton } from "@/components/PageSkeleton";

/** Segment fallback inside PortalChrome — the (portal) layout keeps the
    sidebar and topbar mounted while a page chunk loads; only the body swaps. */
export default function PortalLoading() {
  return <PageSkeleton />;
}
