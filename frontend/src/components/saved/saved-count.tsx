"use client";

import { compare, favorites } from "@/lib/saved-list";
import { useSavedIds } from "@/lib/use-saved";

const LISTS = { favorites, compare } as const;

/** Small counter badge for a header icon; the number is also read out after the label. */
export function SavedCount({ list }: { list: keyof typeof LISTS }) {
  const count = useSavedIds(LISTS[list]).length;
  if (count === 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.625rem] leading-4 font-semibold text-on-gold tabular-nums">
      <span className="sr-only"> (</span>
      {count}
      <span className="sr-only">)</span>
    </span>
  );
}
