"use client";

import { useEffect, useState } from "react";
import { ProductGrid } from "@/components/product/product-grid";
import { recordView } from "@/lib/recently-viewed";
import { useFetchIds } from "@/lib/use-fetch-ids";
import type { ProductSummary } from "@/types/api";

const SHOWN = 8;

/**
 * "Recently viewed" under the product page (#174): records this product, then shows up
 * to 8 others this browser opened before. Renders nothing on a first product view.
 */
export function RecentlyViewed({ productId, title }: { productId: number; title: string }) {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    const before = recordView(productId).slice(0, SHOWN);
    // After paint on purpose: the server cannot know this browser's history.
    const frame = window.requestAnimationFrame(() => setIds(before));
    return () => window.cancelAnimationFrame(frame);
  }, [productId]);

  const state = useFetchIds<ProductSummary>("/api/saved", ids);
  if (ids.length === 0 || state.status !== "done") return null;
  // Keep the viewing order; products that no longer exist drop out.
  const products = ids.flatMap((id) => state.data.find((p) => p.id === id) ?? []);
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="recently-viewed" className="mt-16">
      <h2 id="recently-viewed" className="mb-6 text-2xl">
        {title}
      </h2>
      <ProductGrid products={products} belowFold />
    </section>
  );
}
