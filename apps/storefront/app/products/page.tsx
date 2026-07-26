import type { CategoryItem, ProductListItem } from "@nethrasap/api-client";
import { ProductCard } from "@/components/ProductCard";
import { ProductFilters } from "@/components/ProductFilters";
import { serverApi } from "@/lib/api";

export const dynamic = "force-dynamic";

interface Facets {
  price_min: number;
  price_max: number;
}

type SP = {
  q?: string;
  category?: string;
  prescription?: string;
  price_min?: string;
  price_max?: string;
  in_stock?: string;
  sort?: string;
};

export async function generateMetadata({ searchParams }: { searchParams: SP }) {
  const bits = [searchParams.q, searchParams.category].filter(Boolean);
  return { title: bits.length ? `${bits.join(" · ")} — Products` : "Products" };
}

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const api = serverApi();
  const [data, categories, facets] = await Promise.all([
    api.get<{ items: ProductListItem[]; total: number }>("/products", {
      q: searchParams.q,
      category: searchParams.category,
      prescription: searchParams.prescription,
      price_min: searchParams.price_min,
      price_max: searchParams.price_max,
      in_stock: searchParams.in_stock,
      sort: searchParams.sort,
      limit: 48,
    }),
    api.get<{ items: CategoryItem[] }>("/categories", { limit: 50 }),
    api.get<Facets>("/products/facets"),
  ]);
  const cats = categories.items;
  const activeCat = searchParams.category ? cats.find((c) => c.slug === searchParams.category)?.name : null;

  return (
    <div className="container section">
      <div className="sec-head">
        <h2>{activeCat ?? (searchParams.q ? `Results for “${searchParams.q}”` : "All products")}</h2>
        <span className="muted small">{data.total} item{data.total === 1 ? "" : "s"}</span>
      </div>

      {/* Search */}
      <form action="/products" method="get" className="row" style={{ marginBottom: 18 }}>
        <input
          className="input grow"
          name="q"
          placeholder="Search medicines, devices…"
          defaultValue={searchParams.q ?? ""}
        />
        <button className="btn btn-primary">Search</button>
      </form>

      <ProductFilters
        categories={cats.map((c) => ({ id: c.id, slug: c.slug, name: c.name, product_count: c.product_count }))}
        facets={facets}
      >
        {data.items.length === 0 ? (
          <div className="card pad muted">No products match your filters.</div>
        ) : (
          <div className="grid grid-products">
            {data.items.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </ProductFilters>
    </div>
  );
}
