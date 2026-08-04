import type { CategoryItem } from "@nethrasap/api-client";
import { CategoryTile } from "@/components/CategoryRail";
import { serverApi } from "@/lib/api";
import { getPage, siteText } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const [{ items: categories }, global] = await Promise.all([
    serverApi().get<{ items: CategoryItem[] }>("/categories", { limit: 50 }),
    getPage("global"),
  ]);
  return (
    <div className="container section">
      <h2>{siteText(global, "categories_heading")}</h2>
      <p className="muted small">{siteText(global, "categories_intro")}</p>
      {/* Same tile as the home "Shop by category" rail, laid out 5 per row. */}
      <div className="cat-grid" style={{ marginTop: 18 }}>
        {categories.map((c) => (
          <CategoryTile key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}
