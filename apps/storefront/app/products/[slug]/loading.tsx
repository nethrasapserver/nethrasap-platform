import { Bar, ProductCardSkeleton } from "@/components/Skeletons";

/* PDP skeleton — breadcrumb, gallery square + buy column, then the related
   rail, so the page assembles into the same shapes it loads into. */
export default function ProductLoading() {
  return (
    <div className="container section" aria-busy="true" aria-label="Loading product">
      {/* Breadcrumb */}
      <Bar w={220} h={12} style={{ marginBottom: 16 }} />

      <div className="pdp-top" aria-hidden="true">
        {/* Gallery */}
        <div className="skeleton" style={{ aspectRatio: "1 / 1", width: "100%" }} />

        {/* Buy column */}
        <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <Bar w={110} h={11} />
          <Bar w="80%" h={26} />
          <div className="row" style={{ gap: 8 }}>
            <Bar w={90} h={22} style={{ borderRadius: 999 }} />
            <Bar w={72} h={22} style={{ borderRadius: 999 }} />
          </div>
          <Bar w={140} h={24} style={{ marginTop: 8 }} />
          <Bar w="100%" h={46} style={{ marginTop: 8 }} />
          <Bar w="100%" h={46} />
        </div>
      </div>

      {/* Related rail */}
      <section className="pdp-section" aria-hidden="true">
        <Bar w={190} h={20} style={{ marginBottom: 14 }} />
        <div className="grid grid-shelf">
          {Array.from({ length: 5 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
