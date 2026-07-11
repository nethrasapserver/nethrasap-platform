import type { ProductDetail } from "@nethrasap/api-client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BuyBox } from "@/components/BuyBox";
import { serverApi } from "@/lib/api";
import { stockLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

async function getProduct(slug: string): Promise<ProductDetail | null> {
  try {
    return await serverApi().get<ProductDetail>(`/products/${slug}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const p = await getProduct(params.slug);
  if (!p) return { title: "Product not found" };
  return {
    title: p.name,
    description: p.description ?? `${p.name} by ${p.brand} — available on Nethrasap.`,
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const p = await getProduct(params.slug);
  if (!p) notFound();
  const stock = stockLabel(p.stock_status);
  const img = p.images?.find((i) => i.is_primary) ?? p.images?.[0];

  return (
    <div className="container section">
      <div className="small muted" style={{ marginBottom: 16 }}>
        <Link href="/products">Products</Link> ·{" "}
        <Link href={`/products?category=${p.category_slug}`}>{p.category_name}</Link>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", alignItems: "start" }}>
        <div>
          <div
            className="card"
            style={{
              aspectRatio: "4/3",
              background: "var(--brand-tint)",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {img ? (
              <img src={img.storage_key} alt={img.alt ?? p.name} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
            ) : (
              <span className="muted">No image</span>
            )}
          </div>

          {p.specs && p.specs.length > 0 && (
            <div className="card pad" style={{ marginTop: 18 }}>
              <h3>Specifications</h3>
              <table className="table">
                <tbody>
                  {p.specs.map((s: { label?: string; value?: string }, i: number) => (
                    <tr key={i}>
                      <td className="muted" style={{ width: "40%" }}>
                        {s.label}
                      </td>
                      <td>{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <div className="brand" style={{ textTransform: "uppercase", fontSize: "0.8rem", color: "var(--ink-3)" }}>
              {p.brand}
            </div>
            <h1 style={{ fontSize: "1.7rem" }}>{p.name}</h1>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              <span className={`pill ${stock.cls}`}>{stock.text}</span>
              {p.hsn_code && <span className="pill pill-rx">HSN {p.hsn_code}</span>}
            </div>
          </div>

          <BuyBox product={p} />

          {p.description && <p className="muted">{p.description}</p>}
        </div>
      </div>
    </div>
  );
}
