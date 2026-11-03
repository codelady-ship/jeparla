"use client";

import { useState } from "react";
import { normalizeQuery } from "@/lib/search/normalize";

/** Store checkboxes with a quick text filter (matches without Azerbaijani letters too). */
export function StoreOptions({
  idPrefix,
  stores,
  selected,
  searchLabel,
}: {
  idPrefix: string;
  stores: { slug: string; name: string }[];
  selected: string[];
  searchLabel: string;
}) {
  const [q, setQ] = useState("");
  const needle = normalizeQuery(q);
  return (
    <div className="flex flex-col gap-2">
      {stores.length > 6 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          // Not part of the filter query.
          form=""
          aria-label={searchLabel}
          placeholder={searchLabel}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      )}
      <ul className="flex flex-col gap-1.5">
        {stores.map((s) => (
          <li key={s.slug} hidden={needle !== "" && !normalizeQuery(s.name).includes(needle)}>
            <label
              className="flex items-center gap-2 text-sm"
              htmlFor={`${idPrefix}-store-${s.slug}`}
            >
              <input
                id={`${idPrefix}-store-${s.slug}`}
                type="checkbox"
                name="store"
                value={s.slug}
                defaultChecked={selected.includes(s.slug)}
                className="size-4 accent-primary"
              />
              {s.name}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
