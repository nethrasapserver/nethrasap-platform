import type { CategoryItem, ProductListItem } from "@nethrasap/api-client";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { serverApi } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const bits = [searchParams.q, searchParams.category].filter(Boolean);
  return { title: bits.length ? `${bits.join(" · ")} — Products` : "Products" };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; sort?: string };
}) {
  const api = serverApi();
  const [data, categories] = await Promise.all([
    api.get<{ items: ProductListItem[]; total: number }>("/products", {
      q: searchParams.q,
      category: searchParams.category,
      sort: searchParams.sort,
      limit: 48,
    }),
    api.get<{ items: CategoryItem[] }>("/categories", { limit: 50 }),
  ]);
  const cats = categories.items;

  return (
    <div className="container section">
      <div className="sec-head">
        <h2>
          {searchParams.category
            ? cats.find((c) => c.slug === searchParams.category)?.name ?? "Products"
            : "All products"}
        </h2>
        <span className="muted small">{data.total} items</span>
      </div>

      <form action="/products" method="get" className="row" style={{ marginBottom: 20 }}>
        <input
          className="input grow"
          name="q"
          placeholder="Search medicines, brands, devices…"
          defaultValue={searchParams.q ?? ""}
        />
        {searchParams.category && (
          <input type="hidden" name="category" value={searchParams.category} />
        )}
        <button className="btn btn-primary">Search</button>
      </form>

      <div className="row small" style={{ marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <Link href="/products" className={`pill ${!searchParams.category ? "pill-ok" : "pill-rx"}`}>
          All
        </Link>
        {cats.map((c) => (
          <Link
            key={c.id}
            href={`/products?category=${c.slug}`}
            className={`pill ${searchParams.category === c.slug ? "pill-ok" : "pill-rx"}`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {data.items.length === 0 ? (
        <div className="card pad muted">No products match your search.</div>
      ) : (
        <div className="grid grid-products">
          {data.items.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
