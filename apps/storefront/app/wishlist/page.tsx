"use client";

import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/lib/auth";
import { useSaved } from "@/lib/saved";

export default function WishlistPage() {
  const { user, loading } = useAuth();
  const { wishlist } = useSaved();

  if (!loading && !user) {
    return (
      <div className="container section">
        <div className="card pad">
          Please <Link href="/login">sign in</Link> to see your saved products.
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="row spread">
        <h2>Saved products</h2>
        {wishlist && wishlist.count > 0 && (
          <span className="muted small">
            {wishlist.count} item{wishlist.count === 1 ? "" : "s"} — synced across your devices
          </span>
        )}
      </div>

      {!wishlist ? (
        <div className="muted" style={{ marginTop: 16 }}>
          Loading saved products…
        </div>
      ) : wishlist.count === 0 ? (
        <div className="card pad muted" style={{ marginTop: 16 }}>
          Nothing saved yet. Tap the heart on any product to keep it here.{" "}
          <Link href="/products">Browse products →</Link>
        </div>
      ) : (
        <div className="grid grid-products" style={{ marginTop: 16 }}>
          {wishlist.items.map((it) => (
            <ProductCard key={it.product.id} p={it.product} />
          ))}
        </div>
      )}
    </div>
  );
}
