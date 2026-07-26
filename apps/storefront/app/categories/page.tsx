import type { CategoryItem } from "@nethrasap/api-client";
import { CategoryTile } from "@/components/CategoryRail";
import { serverApi } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { items: categories } = await serverApi().get<{ items: CategoryItem[] }>("/categories", {
    limit: 50,
  });
  return (
    <div className="container section">
      <h2>Shop by category</h2>
      <p className="muted small">Browse the full audited range by department.</p>
      {/* Same tile as the home "Shop by category" rail, laid out 5 per row. */}
      <div className="cat-grid" style={{ marginTop: 18 }}>
        {categories.map((c) => (
          <CategoryTile key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}
