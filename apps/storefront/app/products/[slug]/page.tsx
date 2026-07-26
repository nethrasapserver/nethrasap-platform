import type { ProductDetail, ProductListItem } from "@nethrasap/api-client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyBox, StockBand } from "@/components/BuyBox";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductReviews } from "@/components/ProductReviews";
import { serverApi } from "@/lib/api";

export const dynamic = "force-dynamic";

async function getProduct(slug: string): Promise<ProductDetail | null> {
  try {
    return await serverApi().get<ProductDetail>(`/products/${slug}`);
  } catch {
    return null;
  }
}

async function getRelated(slug: string): Promise<ProductListItem[]> {
  try {
    return await serverApi().get<ProductListItem[]>(`/products/${slug}/related`);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const p = await getProduct(params.slug);
  if (!p) return { title: "Product not found" };
  return {
    title: p.name,
    description: p.description ?? `${p.name} — available on Nethrasap.`,
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const [p, related] = await Promise.all([getProduct(params.slug), getRelated(params.slug)]);
  if (!p) notFound();

  const defaultVariant = p.variants.find((v) => v.is_default) ?? p.variants[0];
  const specs = (p.specs ?? []) as { label?: string; value?: string }[];
  const info = (p.info ?? {}) as NonNullable<typeof p.info>;
  const isColdChain = p.category_slug === "cold-chain";

  // Fallbacks so every product shows useful guidance even before ops fill the
  // detailed fields.
  const uses =
    info.uses ??
    `${p.name} supplied through Nethrasap's audited, GDP-compliant chain.`;
  const composition = info.composition ?? "Full composition is printed on the pack. Contact us for the batch datasheet.";
  const directions =
    info.directions ??
    (info.prescription_required
      ? "Use strictly as directed by your physician. Complete the full course as prescribed."
      : "Take as directed on the label or by your pharmacist.");
  const dosage = (info.dosage_timing ?? []).filter((t) => ["morning", "afternoon", "night"].includes(t));
  const storage = info.storage ?? (isColdChain ? "Store at 2–8°C. Do not freeze." : "Store below 25°C, away from direct sunlight and moisture.");

  // Compliance/attribute grid. Only rows we genuinely hold are rendered —
  // manufacturer, country of origin and ingredients arrive with migration 0013.
  const attributes: [string, React.ReactNode][] = [
    ["Category", p.category_name],
    ...(p.sub_category ? ([["Sub category", p.sub_category]] as [string, React.ReactNode][]) : []),
    ["Pack size", defaultVariant?.pack_size ?? "—"],
    [
      "Schedule",
      p.schedule && p.schedule !== "NONE" ? `Schedule ${p.schedule} (prescription required)` : "Over the counter",
    ],
    ...(p.hsn_code ? ([["HSN code", <span key="hsn" className="mono">{p.hsn_code}</span>]] as [string, React.ReactNode][]) : []),
    ...(defaultVariant?.barcode
      ? ([["SKU", <span key="sku" className="mono">{defaultVariant.barcode}</span>]] as [string, React.ReactNode][])
      : []),
    ["Availability", <StockBand key="stock" status={p.stock_status} />],
  ];

  return (
    <div className="container section">
      <nav className="small muted" style={{ marginBottom: 16 }} aria-label="Breadcrumb">
        <Link href="/products">Products</Link> ·{" "}
        <Link href={`/products?category=${p.category_slug}`}>{p.category_name}</Link>
      </nav>

      <div className="pdp-top">
        <ProductGallery product={p} />

        <div className="pdp-buy">
          <span className="eyebrow">{p.category_name}</span>
          <h1>{p.name}</h1>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", margin: "8px 0 4px" }}>
            <StockBand status={p.stock_status} />
            {p.schedule && p.schedule !== "NONE" && <span className="pill pill-rx">Rx · {p.schedule}</span>}
            {p.reviews > 0 && (
              <a href="#reviews" className="pill pill-info">
                ★ {p.rating.toFixed(1)} · {p.reviews} review{p.reviews === 1 ? "" : "s"}
              </a>
            )}
          </div>

          <BuyBox product={p} />
        </div>
      </div>

      {/* Content sections — anchored rather than JS tabs so each stays
          linkable and visible to search engines. */}
      <nav className="pdp-nav" aria-label="Product sections">
        <a href="#description">Description</a>
        <a href="#how-to-use">How to use</a>
        {specs.length > 0 && <a href="#specs">Specifications</a>}
        <a href="#details">Product details</a>
        <a href="#reviews">Reviews</a>
      </nav>

      <section className="pdp-section" id="description">
        <h2>Description</h2>
        <p className="pdp-prose">
          {p.description ?? `${p.name} supplied through Nethrasap's audited, GDP-compliant chain.`}
        </p>

        {/* Product information — grouped under the description. */}
        <div className="pinfo">
          {/* Healthcare information */}
          <div className="pinfo-block">
            <h3>Healthcare information</h3>
            <p className="pdp-prose">{uses}</p>
            <div className="pinfo-tags">
              <span className={`pill ${info.prescription_required ? "pill-rx" : "pill-ok"}`}>
                {info.prescription_required ? `Prescription required · Schedule ${p.schedule}` : "Over the counter"}
              </span>
              {isColdChain && <span className="pill pill-info">Cold chain · 2–8°C</span>}
              {p.hsn_code && <span className="pill pill-muted">HSN {p.hsn_code}</span>}
              <span className="pill pill-muted">GST {p.gst_rate_pct}%</span>
            </div>
            {info.warnings && (
              <p className="pinfo-warn">
                <b>Safety:</b> {info.warnings}
              </p>
            )}
          </div>

          {/* Materials / composition */}
          <div className="pinfo-block">
            <h3>Materials &amp; composition</h3>
            <p className="pdp-prose">{composition}</p>
          </div>

          {/* How to use */}
          <div className="pinfo-block" id="how-to-use">
            <h3>How to use</h3>
            <p className="pdp-prose">{directions}</p>
            {dosage.length > 0 && (
              <>
                <span className="pinfo-label">When to take</span>
                <div className="dose-row">
                  {(["morning", "afternoon", "night"] as const).map((slot) => {
                    const on = dosage.includes(slot);
                    return (
                      <span key={slot} className={`dose-chip ${on ? "is-on" : ""}`}>
                        <DoseIcon slot={slot} />
                        {slot[0].toUpperCase() + slot.slice(1)}
                      </span>
                    );
                  })}
                </div>
                <p className="small muted" style={{ margin: "8px 0 0" }}>
                  Timing shown is a general guide — always follow your prescription or a pharmacist&apos;s advice.
                </p>
              </>
            )}
          </div>

          {/* Manufacturing & expiry */}
          <div className="pinfo-block">
            <h3>Manufacturing &amp; expiry</h3>
            <div className="pinfo-grid">
              <div>
                <span className="pinfo-label">Manufacturer</span>
                <b>{info.manufacturer ?? "—"}</b>
              </div>
              {info.country_of_origin && (
                <div>
                  <span className="pinfo-label">Country of origin</span>
                  <b>{info.country_of_origin}</b>
                </div>
              )}
              {info.mfg_date && (
                <div>
                  <span className="pinfo-label">Mfg. date</span>
                  <b>{info.mfg_date}</b>
                </div>
              )}
              {info.expiry_date && (
                <div>
                  <span className="pinfo-label">Expiry date</span>
                  <b>{info.expiry_date}</b>
                </div>
              )}
              {info.shelf_life_months != null && (
                <div>
                  <span className="pinfo-label">Shelf life</span>
                  <b>{info.shelf_life_months} months</b>
                </div>
              )}
              <div>
                <span className="pinfo-label">Storage</span>
                <b>{storage}</b>
              </div>
            </div>
            <p className="small muted" style={{ margin: "10px 0 0" }}>
              Exact manufacturing and expiry dates are printed on each pack; a minimum shelf life is guaranteed at dispatch.
            </p>
          </div>
        </div>
      </section>

      {specs.length > 0 && (
        <section className="pdp-section" id="specs">
          <h2>Specifications</h2>
          <table className="table attr-table">
            <tbody>
              {specs.map((s, i) => (
                <tr key={i}>
                  <th scope="row">{s.label}</th>
                  <td>{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="pdp-section" id="details">
        <h2>Product details</h2>
        <table className="table attr-table">
          <tbody>
            {attributes.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ProductReviews slug={p.slug} rating={p.rating} count={p.reviews} />

      {related.length > 0 && (
        <section className="pdp-section">
          <div className="sec-head">
            <h2>You might also need</h2>
            <Link href={`/products?category=${p.category_slug}`} className="small">
              More in {p.category_name} →
            </Link>
          </div>
          <div className="rail">
            {related.map((r) => (
              <ProductCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DoseIcon({ slot }: { slot: "morning" | "afternoon" | "night" }) {
  const d =
    slot === "night"
      ? "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" // moon
      : slot === "afternoon"
        ? "M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5M12 8a4 4 0 100 8 4 4 0 000-8z" // full sun
        : "M17 18a5 5 0 00-10 0M12 2v3M4.2 10.2l1.8 1M18 11.2l1.8-1M3 18h18M2 22h20"; // sunrise
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
