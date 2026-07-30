import { Bar, ProductCardSkeleton } from "@/components/Skeletons";

/* PDP skeleton mirroring the mockup layout — breadcrumb, main square + three
   thumb tiles, buy-box bars, details-table block, then the related rail, so
   the page assembles into the same shapes it loads into. */
export default function ProductLoading() {
  return (
    <div className="container section" aria-busy="true" aria-label="Loading product">
      {/* Breadcrumb */}
      <Bar w={220} h={12} style={{ marginBottom: 16 }} />

      <div className="pdp-top" aria-hidden="true">
        {/* Gallery: main stage + 3 sub-image tiles */}
        <div style={{ display: "grid", gap: 12 }}>
          <div className="skeleton" style={{ aspectRatio: "1 / 1", width: "100%" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: "1 / 1" }} />
            ))}
          </div>
        </div>

        {/* Buy column: eyebrow, title, pack line, rating, then buy-box bars */}
        <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <Bar w={110} h={11} />
          <Bar w="80%" h={26} />
          <Bar w={160} h={14} />
          <Bar w={130} h={12} />
          <div className="row" style={{ gap: 8 }}>
            <Bar w={130} h={22} style={{ borderRadius: 999 }} />
          </div>
          <Bar w={180} h={30} style={{ marginTop: 4 }} />
          <Bar w="100%" h={46} style={{ marginTop: 8 }} />
          <Bar w="100%" h={46} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 8 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <Bar key={i} w="100%" h={66} />
            ))}
          </div>
        </div>
      </div>

      {/* Product details table */}
      <section className="pdp-section" aria-hidden="true">
        <Bar w={160} h={20} style={{ marginBottom: 14 }} />
        <div style={{ display: "grid", gap: 8, maxWidth: 720 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Bar key={i} w="100%" h={34} />
          ))}
        </div>
      </section>

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
