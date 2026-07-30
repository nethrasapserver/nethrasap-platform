import { Bar, CategoryTileSkeleton } from "@/components/Skeletons";

/* Categories skeleton — heading, blurb line, then the 5-per-row tile grid. */
export default function CategoriesLoading() {
  return (
    <div className="container section" aria-busy="true" aria-label="Loading categories">
      <Bar w={220} h={22} />
      <Bar w={300} h={12} style={{ marginTop: 10 }} />
      <div className="cat-grid" style={{ marginTop: 18 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <CategoryTileSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
