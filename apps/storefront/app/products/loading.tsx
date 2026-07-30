import { Bar, ProductCardSkeleton, SectionHeadSkeleton } from "@/components/Skeletons";

/* Catalogue skeleton — heading, search row, then the product grid shape. */
export default function ProductsLoading() {
  return (
    <div className="container section" aria-busy="true" aria-label="Loading products">
      <SectionHeadSkeleton />

      {/* Search bar row */}
      <div className="row" style={{ marginBottom: 18 }} aria-hidden="true">
        <Bar w="100%" h={42} style={{ flex: 1 }} />
        <Bar w={96} h={42} />
      </div>

      <div className="grid grid-products">
        {Array.from({ length: 12 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
