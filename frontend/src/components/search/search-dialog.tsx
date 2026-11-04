"use client";

import { Clock, Loader2, Search, Store, Tag, Gem, X } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { addRecent, clearRecent, readRecent } from "@/lib/search/recent";
import type { Suggestions } from "@/types/api";
import { cn } from "cn";
import { formatPrice } from "@/lib/money";

export type SearchLabels = {
  open: string;
  title: string;
  placeholder: string;
  recent: string;
  clearRecent: string;
  stores: string;
  categories: string;
  products: string;
  seeAll: string;
  loading: string;
  empty: string;
  error: string;
  /** Raw ICU-free template with {count}: "{count} results". */
  results: string;
  close: string;
};

type Item = {
  id: string;
  group: keyof typeof GROUP_ICON;
  label: string;
  sub?: string;
  href: string;
};

const GROUP_ICON = { recent: Clock, stores: Store, categories: Tag, products: Gem } as const;
const DEBOUNCE_MS = 200;

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: Suggestions }
  | { status: "error" };

/**
 * Header search: one box, suggestions grouped by store, category and product.
 * ARIA combobox with a listbox; arrows move, Enter opens, Esc closes.
 */
export function SearchDialog({ labels }: { labels: SearchLabels }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const router = useRouter();
  const locale = useLocale();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" opens search from anywhere except while typing in a field.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !el.closest("input, textarea, select, [contenteditable]")
      ) {
        e.preventDefault();
        setRecent(readRecent());
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function changeOpen(next: boolean) {
    if (next) setRecent(readRecent());
    setOpen(next);
  }

  function changeQuery(value: string) {
    setQuery(value);
    setActive(-1);
    setState(value.trim() ? { status: "loading" } : { status: "idle" });
  }

  // Debounced fetch; the status was already set to "loading" by changeQuery.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        setState({ status: "done", data: (await res.json()) as Suggestions });
      } catch {
        if (!ctrl.signal.aborted) setState({ status: "error" });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const groups = useMemo((): { key: Item["group"]; title: string; items: Item[] }[] => {
    if (state.status === "idle") {
      return recent.length
        ? [
            {
              key: "recent",
              title: labels.recent,
              items: recent.map((r, i) => ({
                id: `r${i}`,
                group: "recent",
                label: r,
                href: `/search?q=${encodeURIComponent(r)}`,
              })),
            },
          ]
        : [];
    }
    if (state.status !== "done") return [];
    const d = state.data;
    return [
      {
        key: "stores" as const,
        title: labels.stores,
        items: d.stores.map((s) => ({
          id: `s-${s.slug}`,
          group: "stores" as const,
          label: s.name,
          sub: s.city,
          href: `/stores/${s.slug}`,
        })),
      },
      {
        key: "categories" as const,
        title: labels.categories,
        items: d.categories.map((c) => ({
          id: `c-${c.slug}`,
          group: "categories" as const,
          label: c.name[locale],
          href: `/categories/${c.slug}`,
        })),
      },
      {
        key: "products" as const,
        title: labels.products,
        items: d.products.map((p) => ({
          id: `p-${p.slug}`,
          group: "products" as const,
          label: p.name[locale],
          sub: formatPrice(p.priceFrom.amount, locale),
          href: `/products/${p.slug}`,
        })),
      },
    ].filter((g) => g.items.length > 0);
  }, [state, recent, labels, locale]);

  const flat = groups.flatMap((g) => g.items);
  const count = state.status === "done" ? flat.length : 0;

  function go(href: string) {
    if (query.trim()) setRecent(addRecent(query));
    setOpen(false);
    changeQuery("");
    router.push(href);
  }

  function submit() {
    const q = query.trim();
    if (!q) return;
    go(`/search?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && flat.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp" && flat.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? flat.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && flat[active]) go(flat[active].href);
      else submit();
    }
  }

  const optionId = (item: Item) => `${listId}-${item.id}`;
  let index = -1;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger
        className={buttonVariants({ variant: "ghost", size: "icon" })}
        aria-label={labels.open}
        aria-keyshortcuts="/"
      >
        <Search aria-hidden className="size-4" />
      </DialogTrigger>
      <DialogContent
        closeLabel={labels.close}
        showCloseButton={false}
        className="top-[12vh] translate-y-0 gap-0 p-0 sm:max-w-xl"
        initialFocus={inputRef}
      >
        <DialogTitle className="sr-only">{labels.title}</DialogTitle>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 border-b px-4"
        >
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            name="q"
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 && flat[active] ? optionId(flat[active]) : undefined}
            autoComplete="off"
            enterKeyHint="search"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {state.status === "loading" && (
            <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={labels.close}
            className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
          >
            <X aria-hidden className="size-4" />
          </button>
        </form>

        <p className="sr-only" aria-live="polite">
          {state.status === "loading"
            ? labels.loading
            : state.status === "done"
              ? labels.results.replace("{count}", String(count))
              : ""}
        </p>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {state.status === "error" && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{labels.error}</p>
          )}
          {state.status === "done" && count === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{labels.empty}</p>
          )}
          <div id={listId} role="listbox" aria-label={labels.title}>
            {groups.map((g) => {
              const Icon = GROUP_ICON[g.key];
              const headingId = `${listId}-${g.key}`;
              return (
                <div key={g.key} role="group" aria-labelledby={headingId} className="py-1">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span
                      id={headingId}
                      className="text-xs font-semibold text-muted-foreground uppercase"
                    >
                      {g.title}
                    </span>
                    {g.key === "recent" && (
                      <button
                        type="button"
                        onClick={() => {
                          clearRecent();
                          setRecent([]);
                        }}
                        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {labels.clearRecent}
                      </button>
                    )}
                  </div>
                  {g.items.map((item) => {
                    index += 1;
                    const i = index;
                    return (
                      <div
                        key={item.id}
                        id={optionId(item)}
                        role="option"
                        aria-selected={i === active}
                        onMouseEnter={() => setActive(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(item.href)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
                          i === active && "bg-muted",
                        )}
                      >
                        <Icon aria-hidden className="size-4 shrink-0 text-gold-text" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.sub && (
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {item.sub}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {state.status === "loading" && (
            <ul aria-hidden className="flex flex-col gap-2 p-3">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-5 animate-pulse rounded bg-muted" />
              ))}
            </ul>
          )}
          {query.trim() && state.status === "done" && (
            <button
              type="button"
              onClick={submit}
              className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
            >
              {labels.seeAll.replace("{query}", query.trim())}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
