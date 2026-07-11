import type { CategoryItem } from "@nethrasap/api-client";
import Link from "next/link";
import { serverApi } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { items: categories } = await serverApi().get<{ items: CategoryItem[] }>("/categories", {
    limit: 50,
  });
  return (
    <div className="container section">
      <h2>Categories</h2>
      <div className="grid grid-cats" style={{ marginTop: 18 }}>
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
    </div>
  );
}
