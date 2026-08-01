import { getPage, str } from "@/lib/content";

/* Top-of-shell announcement strip, driven by the global CMS page's
   `announcement{text}` block.

   Behaviour:
   - Active announcement with text  → render it.
   - An announcement block exists but is inactive (editor turned it off) → hide.
   - No announcement block at all (CMS empty / unreachable) → fall back to the
     original hardcoded copy, so the strip is never blank on a fresh install.

   Server component: fetches the global page itself, so the integrator only has
   to drop <AnnouncementBar /> into the shell. */
export async function AnnouncementBar() {
  const page = await getPage("global");

  const active = page.blocks.find((b) => b.kind === "announcement" && b.is_active !== false);
  const text = str(active?.content, "text");
  if (text) {
    return <div className="announce">{text}</div>;
  }

  // Distinguish "editor switched it off" from "no CMS data".
  const hasAnnouncementBlock = page.blocks.some((b) => b.kind === "announcement");
  if (hasAnnouncementBlock) return null;

  // Fallback: original copy, verbatim (including the bold lead).
  return (
    <div className="announce">
      <b>Pan-India delivery</b> across serviceable pincodes · GDP-compliant cold chain · CDSCO-verified sourcing
    </div>
  );
}
