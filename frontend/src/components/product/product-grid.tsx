import { SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { revealStep } from "@/lib/motion/reveal-step";
import type { ProductSummary } from "@/types/api";
import { ProductCard } from "./product-card";

const GRID = "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4";
/** Cards in the first row are on screen at load: no reveal, image preloaded. */
const FIRST_ROW = 4;

type Props = {
  products: ProductSummary[];
  /** Shown instead of the grid when there are no products. */
  empty?: ReactNode;
  /** Replaces the column classes (for example two columns in a half-width split). */
  className?: string;
  /**
   * The grid starts below the first screen (home page under the hero, related pieces on
   * a product page): no image is preloaded, so nothing competes with the first paint.
   */
  belowFold?: boolean;
  /**
   * The grid sits in a <Reveal stagger>: the first-row cards are its items and come in
   * one after another (one beat after the group's first item).
   */
  revealItems?: boolean;
};

export function ProductGrid({
  products,
  empty,
  className,
  belowFold = false,
  revealItems = false,
}: Props) {
  if (products.length === 0) return <>{empty}</>;
  return (
    <ul className={className ?? GRID}>
      {products.map((p, i) =>
        i < FIRST_ROW ? (
          <li key={p.id} className="flex" {...(revealItems ? revealStep(i + 1) : {})}>
            <ProductCard product={p} preload={!belowFold && i < 2} />
          </li>
        ) : (
          <Reveal key={p.id} as="li" index={i % FIRST_ROW} className="flex card-deferred">
            <ProductCard product={p} />
          </Reveal>
        ),
      )}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 8, label }: { count?: number; label: string }) {
  return (
    <ul className={GRID} aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-[4/5] w-full rounded-lg" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-1/4" />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridEmpty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      <SearchX aria-hidden className="size-8 text-muted-foreground" />
      <h2 className="text-xl">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}
