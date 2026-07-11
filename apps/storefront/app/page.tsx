import type { CategoryItem, ProductListItem } from "@nethrasap/api-client";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { serverApi } from "@/lib/api";

export const dynamic = "force-dynamic"; // always fresh catalogue

async function getData() {
  const api = serverApi();
  const [featured, categories] = await Promise.all([
    api.get<{ items: ProductListItem[] }>("/products", { featured: true, limit: 8 }),
    api.get<{ items: CategoryItem[] }>("/categories", { limit: 50 }),
  ]);
  return { featured: featured.items, categories: categories.items };
}

export default async function HomePage() {
  const { featured, categories } = await getData();
  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="pill pill-ok" style={{ marginBottom: 14 }}>
            ● GDP-compliant · CDSCO-verified
          </span>
          <h1>India&apos;s audited healthcare supply platform</h1>
          <p>
            Prescription medicines, OTC, devices and cold-chain biologics — sourced through a
            verified, temperature-controlled supply chain with role-based wholesale pricing.
          </p>
          <div className="row" style={{ marginTop: 22 }}>
            <Link href="/products" className="btn btn-primary">
              Browse products
            </Link>
            <Link href="/signup" className="btn btn-outline">
              Register as retailer / clinician
            </Link>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="sec-head">
          <h2>Shop by category</h2>
          <Link href="/categories" className="small">
            All categories →
          </Link>
        </div>
        <div className="grid grid-cats">
          {categories.map((c) => (
            <Link key={c.id} href={`/products?category=${c.slug}`} className="card pad">
              <div style={{ fontWeight: 650 }}>{c.name}</div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {c.description}
              </div>
              <div className="brand" style={{ marginTop: 10, fontSize: "0.75rem" }}>
                {c.product_count} products
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section container" style={{ paddingTop: 0 }}>
        <div className="sec-head">
          <h2>Featured</h2>
          <Link href="/products" className="small">
            View all →
          </Link>
        </div>
        <div className="grid grid-products">
          {featured.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>
    </>
  );
}
