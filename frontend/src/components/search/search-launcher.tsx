"use client";

import { Search } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { SearchLabels } from "./search-dialog";

const load = () => import("./search-dialog");
const SearchDialog = lazy(load);

/**
 * Header search button. The dialog code (combobox, fetch, keyboard) is a separate
 * chunk: it loads when the visitor points at, focuses or presses the button, or
 * types "/". Keeps every page under the Lighthouse script budget.
 */
export function SearchLauncher({ labels }: { labels: SearchLabels }) {
  const [armed, setArmed] = useState<null | "open" | "idle">(null);

  useEffect(() => {
    if (armed) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !el.closest("input, textarea, select, [contenteditable]")
      ) {
        e.preventDefault();
        setArmed("open");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed]);

  const button = (
    <button
      type="button"
      className={buttonVariants({ variant: "ghost", size: "icon" })}
      aria-label={labels.open}
      aria-keyshortcuts="/"
      aria-haspopup="dialog"
      onPointerEnter={() => void load()}
      onFocus={() => void load()}
      onClick={() => setArmed("open")}
    >
      <Search aria-hidden />
    </button>
  );

  if (!armed) return button;
  return (
    <Suspense fallback={button}>
      <SearchDialog labels={labels} defaultOpen={armed === "open"} />
    </Suspense>
  );
}
