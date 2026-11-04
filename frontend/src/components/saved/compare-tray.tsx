"use client";

import { GitCompareArrows } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { compare, MAX_COMPARE } from "@/lib/saved-list";
import { useSavedIds } from "@/lib/use-saved";

/** Floating shortcut to /compare while something is selected for comparison. */
export function CompareTray({ label }: { label: string }) {
  const count = useSavedIds(compare).length;
  const pathname = usePathname();
  if (count === 0 || pathname === "/compare") return null;
  return (
    <Link
      href="/compare"
      prefetch={false}
      className="fixed right-4 bottom-4 z-40 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <GitCompareArrows aria-hidden className="size-4" />
      {label}
      <span className="tabular-nums">
        {count}/{MAX_COMPARE}
      </span>
    </Link>
  );
}
