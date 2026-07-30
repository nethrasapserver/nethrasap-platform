import type { ProductDetail, ProductListItem, Schemas } from "@nethrasap/api-client";
import { ApiError } from "@nethrasap/api-client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BuyBox } from "@/components/BuyBox";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetailsTable } from "@/components/ProductDetailsTable";
import { ProductGallery } from "@/components/ProductGallery";
import { ReviewsSection } from "@/components/ReviewsSection";
import { TrustBadges } from "@/components/TrustBadges";
import { serverApi } from "@/lib/api";

export const dynamic = "force-dynamic";

type ReviewPage = Schemas["Paginated_ReviewOut_"];

/* cache() dedupes within the request, so generateMetadata and the page share
   one fetch. Only a genuine API 404 becomes null (→ notFound()); anything
   else — 5xx, timeout, network — rethrows into error.tsx. Mapping outages to
   404 would de-index live products. */
const getProduct = cache(async (slug: string): Promise<ProductDetail | null> => {
  try {
    return await serverApi().get<ProductDetail>(`/products/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

/* Related items are decoration — if this call fails the rail simply doesn't
   render, which is deliberate: a broken sidebar must never 500 the product. */
async function getRelated(slug: string): Promise<ProductListItem[]> {
  try {
    return await serverApi().get<ProductListItem[]>(`/products/${slug}/related`);
  } catch {
    return [];
  }
}

/* First page of reviews, server-fetched so the section renders without a
   client round-trip. Failures degrade to an empty section, never a 500. */
async function getReviews(slug: string): Promise<ReviewPage | null> {
  try {
    return await serverApi().get<ReviewPage>(`/products/${slug}/reviews`, { limit: 10 });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const p = await getProduct(params.slug);
  if (!p) return { title: "Product not found" };
  return {
    title: p.name,
    description: p.description ?? `${p.name} — available on Nethrasap.`,
  };
}

/* Free-form attributes JSONB — read defensively, ops fill these by hand.
   Typed structurally until the generated schema exposes `attributes`. */
type Attrs = Record<string, unknown>;

function attrString(attrs: Attrs, key: string): string | null {
  const v = attrs[key];
  return typeof v === "string" && v.trim() ? v : null;
}

function attrStringList(attrs: Attrs, key: string): string[] {
  const v = attrs[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}

type Ingredient = { name: string; grade?: string; strength?: string };

function attrIngredients(attrs: Attrs): Ingredient[] {
  const v = attrs.ingredients;
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) =>
    x && typeof x === "object" && typeof (x as Ingredient).name === "string" ? [x as Ingredient] : [],
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24"
          fill={i <= Math.round(value) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z" />
        </svg>
      ))}
    </span>
  );
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const [p, related, reviewPage] = await Promise.all([
    getProduct(params.slug),
    getRelated(params.slug),
    getReviews(params.slug),
  ]);
  if (!p) notFound();

  const defaultVariant = p.variants.find((v) => v.is_default) ?? p.variants[0];
  const attrs = (((p as { attributes?: unknown }).attributes ?? {}) as Attrs);

  // Eyebrow: brand · category. The closest thing to a brand is the maker's
  // name; take it up to the first comma so a full registered address doesn't
  // flood the line.
  const manufacturer = attrString(attrs, "manufacturer");
  const brand = manufacturer?.split(",")[0]?.trim() || null;
  const eyebrow = brand ? `${brand} · ${p.category_name}` : p.category_name;

  const tags = attrStringList(attrs, "tags");
  const ingredients = attrIngredients(attrs);
  const indications = attrString(attrs, "indications") ?? attrString(attrs, "uses");
  const dosage = attrString(attrs, "dosage") ?? attrString(attrs, "directions");
  const warnings = attrString(attrs, "warnings");

  return (
    <div className="container section">
      <nav className="small muted" style={{ marginBottom: 16 }} aria-label="Breadcrumb">
        <Link href="/products">Products</Link> ·{" "}
        <Link href={`/products?category=${p.category_slug}`}>{p.category_name}</Link>
      </nav>

      <div className="pdp-top">
        <ProductGallery product={p} />

        <div className="pdp-buy">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{p.name}</h1>
          {defaultVariant && (
            <p className="pack-line">
              {defaultVariant.pack_size}
              {defaultVariant.unit_label ? ` · ${defaultVariant.unit_label}` : ""}
            </p>
          )}
          {p.reviews > 0 && (
            <div className="rating-row">
              <Stars value={p.rating} />
              <b>{p.rating.toFixed(1)}</b>
              <a href="#reviews">({p.reviews} rating{p.reviews === 1 ? "" : "s"})</a>
            </div>
          )}

          <BuyBox product={p} />
          <TrustBadges />
        </div>
      </div>

      <ProductDetailsTable product={p} />

      {tags.length > 0 && (
        <section className="pdp-section" id="tags">
          <h2>Tags</h2>
          <div className="tags-row">
            {tags.map((t) => (
              <span key={t} className="tag-chip">{t}</span>
            ))}
          </div>
        </section>
      )}

      {p.description && (
        <section className="pdp-section" id="description">
          <h2>Description</h2>
          <p className="pdp-prose">{p.description}</p>
        </section>
      )}

      {ingredients.length > 0 && (
        <section className="pdp-section" id="composition">
          <h2>Composition</h2>
          <table className="ing-table">
            <thead>
              <tr>
                <th scope="col">Ingredient</th>
                <th scope="col">Grade</th>
                <th scope="col">Strength</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing) => (
                <tr key={ing.name}>
                  <td>{ing.name}</td>
                  <td>{ing.grade ?? "—"}</td>
                  <td className="mono">{ing.strength ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(indications || dosage || warnings) && (
        <section className="pdp-section" id="indications">
          <h2>Indications &amp; dosage</h2>
          <table className="pdp-attrs">
            <tbody>
              {indications && (
                <tr>
                  <th scope="row">Indications</th>
                  <td>{indications}</td>
                </tr>
              )}
              {dosage && (
                <tr>
                  <th scope="row">Dosage</th>
                  <td>{dosage}</td>
                </tr>
              )}
              {warnings && (
                <tr>
                  <th scope="row">Warnings</th>
                  <td>{warnings}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      <ReviewsSection slug={p.slug} rating={p.rating} count={p.reviews} initial={reviewPage} />

      {related.length > 0 && (
        <section className="pdp-section">
          <div className="sec-head">
            <h2>You might also need</h2>
            <Link href={`/products?category=${p.category_slug}`} className="small">
              More in {p.category_name} →
            </Link>
          </div>
          <div className="rail">
            {related.map((r) => (
              <ProductCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
