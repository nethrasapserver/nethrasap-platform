import type { ProductDetail } from "@nethrasap/api-client";
import { StockBand } from "@/components/BuyBox";

/* Compliance/attribute table. Owner directive (2026-07-31): this section keeps
   the existing PDP details-table pattern — ice-50 label column, white value
   cells, horizontal dividers only, enum-ish values as pill chips — as an
   approved exception to the all-white mockup style. Every row is
   omit-when-absent; `attributes` is the free-form JSONB the backend passes
   through on the PDP, so read it defensively. */

type Attrs = Record<string, unknown>;

function attrString(attrs: Attrs, key: string): string | null {
  const v = attrs[key];
  return typeof v === "string" && v.trim() ? v : null;
}

export function ProductDetailsTable({ product }: { product: ProductDetail }) {
  const attrs = (((product as { attributes?: unknown }).attributes ?? {}) as Attrs);
  const defaultVariant = product.variants.find((v) => v.is_default) ?? product.variants[0];

  const composition = attrString(attrs, "composition");
  const countryOfOrigin = attrString(attrs, "country_of_origin");
  const manufacturer = attrString(attrs, "manufacturer");
  const storage = attrString(attrs, "storage");
  const shelfLife = typeof attrs.shelf_life_months === "number" ? attrs.shelf_life_months : null;
  const scheduled = product.schedule && product.schedule !== "NONE";

  const rows: [string, React.ReactNode][] = [
    ["Category", `${product.category_name}${product.sub_category ? ` → ${product.sub_category}` : ""}`],
    ...(defaultVariant?.pack_size
      ? ([["Pack size", defaultVariant.pack_size]] as [string, React.ReactNode][])
      : []),
    [
      "Prescription",
      scheduled ? (
        <span key="rx" className="pill pill-rx">Prescription — Schedule {product.schedule}</span>
      ) : (
        <span key="rx" className="pill pill-ok">Over the counter</span>
      ),
    ],
    ...(defaultVariant?.barcode
      ? ([["SKU", <span key="sku" className="mono">{defaultVariant.barcode}</span>]] as [string, React.ReactNode][])
      : []),
    ...(product.hsn_code
      ? ([["HSN code", <span key="hsn" className="mono">{product.hsn_code}</span>]] as [string, React.ReactNode][])
      : []),
    ["GST rate", <span key="gst" className="mono">{product.gst_rate_pct}%</span>],
    ...(composition ? ([["Composition", composition]] as [string, React.ReactNode][]) : []),
    ...(manufacturer ? ([["Manufacturer / marketer", manufacturer]] as [string, React.ReactNode][]) : []),
    ...(countryOfOrigin ? ([["Country of origin", countryOfOrigin]] as [string, React.ReactNode][]) : []),
    ...(storage ? ([["Storage", storage]] as [string, React.ReactNode][]) : []),
    ...(shelfLife != null ? ([["Shelf life", `${shelfLife} months`]] as [string, React.ReactNode][]) : []),
    ["Availability", <StockBand key="stock" status={product.stock_status} />],
  ];

  return (
    <section className="pdp-section" id="details">
      <h2>Product details</h2>
      <table className="table attr-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
