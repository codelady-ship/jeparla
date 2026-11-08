"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Search box and status select of an admin list. Both live in the URL
 * (?q=&status=) through history.replaceState, so a link from the overview opens
 * the filtered list and the server is not asked again on each key.
 */
export function useListFilter<S extends string>(initialQuery: string, initialStatus: S, all: S) {
  const [q, setQ] = useState(initialQuery);
  const [status, setStatus] = useState<S>(initialStatus);

  function sync(nextQ: string, nextStatus: S) {
    const sp = new URLSearchParams();
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    if (nextStatus !== all) sp.set("status", nextStatus);
    const s = sp.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }

  return {
    q,
    status,
    setQ(v: string) {
      setQ(v);
      sync(v, status);
    },
    setStatus(v: S) {
      setStatus(v);
      sync(q, v);
    },
    clear() {
      setQ("");
      setStatus(all);
      sync("", all);
    },
  };
}

export function ListToolbar<S extends string>({
  filter,
  options,
  labels,
}: {
  filter: ReturnType<typeof useListFilter<S>>;
  options: readonly { value: S; label: string }[];
  labels: { search: string; status: string };
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="relative flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={labels.search}
          placeholder={labels.search}
          value={filter.q}
          onChange={(e) => filter.setQ(e.target.value)}
          className="h-11 pl-9"
        />
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium sm:w-56">
        {labels.status}
        <select
          value={filter.status}
          onChange={(e) => filter.setStatus(e.target.value as S)}
          className="h-11 rounded-lg border border-input bg-background px-2.5 text-base font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Shown when the filters hide every row. */
export function EmptyFiltered({
  text,
  clearLabel,
  onClear,
}: {
  text: string;
  clearLabel: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-12 text-center">
      <p>{text}</p>
      <Button type="button" variant="outline" size="lg" onClick={onClear}>
        {clearLabel}
      </Button>
    </div>
  );
}
