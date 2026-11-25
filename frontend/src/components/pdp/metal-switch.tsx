import { Link } from "@/i18n/navigation";
import { cn } from "cn";
import type { MetalType } from "@/types/api";

const ORDER: MetalType[] = ["GOLD", "SILVER", "PLATINUM", "PALLADIUM"];

/**
 * Same design in another metal (owner decision 2026-11-25): the store linked this product with
 * one in another metal, and each keeps its own photos, on-model image and prices. Two plain
 * links, no client script: the current metal is marked aria-current, the other opens its page.
 */
export function MetalSwitch({
  metal,
  sibling,
  label,
  names,
}: {
  metal: MetalType;
  sibling: { slug: string; metal: MetalType };
  /** Name of the navigation, e.g. "Bu dizayn başqa metalda". */
  label: string;
  names: Record<MetalType, string>;
}) {
  const items = [
    { metal, href: null },
    { metal: sibling.metal, href: `/products/${sibling.slug}` },
  ].sort((a, b) => ORDER.indexOf(a.metal) - ORDER.indexOf(b.metal));
  const pill =
    "touch-target inline-flex min-w-20 items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium";
  return (
    <nav aria-label={label}>
      <ul className="inline-flex gap-1 rounded-full border bg-background p-1">
        {items.map((item) => (
          <li key={item.metal}>
            {item.href === null ? (
              <span aria-current="page" className={cn(pill, "bg-primary text-primary-foreground")}>
                {names[item.metal]}
              </span>
            ) : (
              <Link
                href={item.href}
                prefetch={false}
                className={cn(
                  pill,
                  "outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
                )}
              >
                {names[item.metal]}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
