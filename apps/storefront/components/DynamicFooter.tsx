import Link from "next/link";
import {
  DEFAULT_FOOTER_BLURB,
  DEFAULT_FOOTER_COLUMNS,
  DEFAULT_FOOTER_LEGAL,
  arr,
  blocksOf,
  firstBlock,
  getPage,
  siteLogo,
  str,
  type FooterColumn,
  type FooterLink,
} from "@/lib/content";

/* Site footer, driven by the global CMS page:
   - footer_blurb{text}          → the lede under the wordmark
   - footer_column{heading,items}→ the link columns (items with href render as
     links, items without href render as plain spans, matching the original)
   - footer_legal{text}          → the bottom bar

   Each piece degrades independently to the original hardcoded markup, so a
   partially-configured (or entirely empty) global page still renders the
   footer exactly as before.

   Server component: fetches the global page itself so the integrator only has
   to drop <DynamicFooter /> into the shell in place of <Footer />. */

function toColumn(content: Record<string, unknown> | undefined): FooterColumn | null {
  const heading = str(content, "heading");
  if (!heading) return null;
  const items: FooterLink[] = arr(content, "items")
    .map((raw): FooterLink | null => {
      const item = raw as Record<string, unknown>;
      const label = str(item, "label");
      if (!label) return null;
      const href = str(item, "href");
      return href ? { label, href } : { label };
    })
    .filter((x): x is FooterLink => x !== null);
  return { heading, items };
}

export async function DynamicFooter() {
  const page = await getPage("global");

  const blurb = str(firstBlock(page, "footer_blurb")?.content, "text") ?? DEFAULT_FOOTER_BLURB;
  const legal = str(firstBlock(page, "footer_legal")?.content, "text") ?? DEFAULT_FOOTER_LEGAL;

  const cmsColumns = blocksOf(page, "footer_column")
    .map((b) => toColumn(b.content))
    .filter((c): c is FooterColumn => c !== null);
  const columns = cmsColumns.length > 0 ? cmsColumns : DEFAULT_FOOTER_COLUMNS;

  const logo = siteLogo(page);

  return (
    <footer className="footer">
      <div className="container">
        <div style={{ maxWidth: 280 }}>
          <div className="logo" style={{ marginBottom: 8 }}>
            {logo.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="logo-img" src={logo.image} alt={`${logo.text}${logo.accent}`} />
            ) : (
              <>
                {logo.text}
                {logo.accent && <span>{logo.accent}</span>}
              </>
            )}
          </div>
          <p className="small">{blurb}</p>
        </div>
        {columns.map((col) => (
          <div key={col.heading}>
            <h4 className="small">{col.heading}</h4>
            <div style={{ display: "grid", gap: 6 }} className="small">
              {col.items.map((item) =>
                item.href ? (
                  <Link key={item.label} href={item.href}>
                    {item.label}
                  </Link>
                ) : (
                  <span key={item.label}>{item.label}</span>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="footer-bar">
        <div className="container">{legal}</div>
      </div>
    </footer>
  );
}
