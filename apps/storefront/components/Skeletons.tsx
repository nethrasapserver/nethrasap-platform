/* Shimmer placeholders shared by the route-level loading.tsx files.
   The `.skeleton` class (packages/ui/styles.css) carries the gradient +
   animation; the global prefers-reduced-motion rule in styles/animations.css
   stills it for users who ask for less motion. Server components — no state. */

export function Bar({
  w,
  h = 12,
  style,
}: {
  w: number | string;
  h?: number;
  style?: React.CSSProperties;
}) {
  return <div className="skeleton" style={{ width: w, height: h, ...style }} />;
}

/* Mirrors .pcard: square thumb, then brand / name / price lines. */
export function ProductCardSkeleton() {
  return (
    <div className="pcard" aria-hidden="true">
      <div className="skeleton" style={{ aspectRatio: "1 / 1", borderRadius: 0 }} />
      <div className="body">
        <Bar w="40%" h={10} />
        <Bar w="85%" h={14} />
        <Bar w="55%" h={14} style={{ marginTop: 10 }} />
      </div>
    </div>
  );
}

/* Mirrors .cat-tile: 16/10 media, then name / count lines. */
export function CategoryTileSkeleton() {
  return (
    <div className="cat-tile" aria-hidden="true">
      <div className="skeleton" style={{ width: "100%", aspectRatio: "16 / 10" }} />
      <Bar w="70%" h={13} />
      <Bar w="45%" h={10} />
    </div>
  );
}

/* Section heading pair (title + trailing link), matching .sec-head. */
export function SectionHeadSkeleton() {
  return (
    <div className="sec-head" aria-hidden="true">
      <Bar w={190} h={22} />
      <Bar w={90} h={12} />
    </div>
  );
}
