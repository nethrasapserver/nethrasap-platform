import { arr, blocksOf, getPage, siteText, str } from "@/lib/content";
import { Header } from "./Shell";

/* Server wrapper: reads the global CMS page and feeds the (client) Header its
   nav links and trending search terms, so both are editable from the dashboard
   (global surface → header_nav / trending). Each block is either {label,href}
   or {links:[…]} / {terms:[…]}. Falls back to the Header's own defaults when
   the CMS has none. */
export async function SiteHeader() {
  const page = await getPage("global");

  const nav = blocksOf(page, "header_nav").flatMap((b) => {
    const links = arr(b.content, "links");
    if (links.length) {
      return links
        .map((raw) => {
          const l = raw as Record<string, unknown>;
          const label = str(l, "label");
          return label ? { label, href: str(l, "href") ?? "#" } : null;
        })
        .filter((x): x is { label: string; href: string } => x !== null);
    }
    const label = str(b.content, "label");
    return label ? [{ label, href: str(b.content, "href") ?? "#" }] : [];
  });

  const trending = blocksOf(page, "trending").flatMap((b) => {
    const terms = arr(b.content, "terms").filter((t): t is string => typeof t === "string" && t.trim().length > 0);
    if (terms.length) return terms;
    const one = str(b.content, "label") ?? str(b.content, "term") ?? str(b.content, "text");
    return one ? [one] : [];
  });

  return (
    <Header
      nav={nav.length ? nav : undefined}
      trending={trending.length ? trending : undefined}
      searchPlaceholder={siteText(page, "search_placeholder")}
    />
  );
}
