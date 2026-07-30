import { Bar, CategoryTileSkeleton, ProductCardSkeleton, SectionHeadSkeleton } from "@/components/Skeletons";

/* Homepage skeleton — hero band, trust strip, category rail and the featured
   shelf, in the shapes the real sections settle into so nothing jumps. */
export default function HomeLoading() {
  return (
    <div aria-busy="true" aria-label="Loading Nethrasap">
      {/* Hero band */}
      <div className="skeleton" style={{ height: 320, borderRadius: 0 }} />

      {/* Trust strip */}
      <section className="container" style={{ paddingTop: "var(--sp-6)" }}>
        <div className="card pad" aria-hidden="true">
          <Bar w="100%" h={44} />
        </div>
      </section>

      {/* Category rail */}
      <section className="section container">
        <SectionHeadSkeleton />
        <div className="cat-grid">
          {Array.from({ length: 5 }, (_, i) => (
            <CategoryTileSkeleton key={i} />
          ))}
        </div>
      </section>

      {/* Featured shelf — two rows of five, same as SHELF_SIZE */}
      <section className="section container" style={{ paddingTop: 0 }}>
        <SectionHeadSkeleton />
        <div className="grid grid-shelf">
          {Array.from({ length: 10 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
