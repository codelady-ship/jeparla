"use client";

import { Check, ChevronDown, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition, type FocusEvent, type KeyboardEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { stripLocale } from "@/i18n/strip-locale";
import { cn } from "cn";

type Props = {
  /** Where the list opens: below the button (header) or above it (footer, menu sheet). */
  side?: "bottom" | "top";
};

/**
 * Language menu in the site's own tones (the native select opened with the system's blue
 * list). A button names the current language; the list opens on click, closes on Escape or
 * when focus leaves, and each language is a button in its own language.
 * The URL is read only when the user switches, not during render, so the header and footer
 * stay part of the static shell. next-intl stores the choice in a cookie.
 */
export function LocaleSwitcher({ side = "bottom" }: Props) {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  function choose(next: Locale) {
    setOpen(false);
    button.current?.focus();
    if (next === locale) return;
    const href = stripLocale(window.location.pathname, window.location.search);
    startTransition(() => {
      router.replace(href, { locale: next, scroll: false });
    });
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape" || !open) return;
    e.stopPropagation();
    setOpen(false);
    button.current?.focus();
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  };

  return (
    <div className="relative inline-flex text-sm" onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${t("label")}: ${t(`locale.${locale as Locale}`)}`}
        disabled={isPending}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 pointer-coarse:h-11"
      >
        <Languages aria-hidden className="size-4 text-muted-foreground" />
        <span lang={locale}>{t(`locale.${locale as Locale}`)}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 transition-transform duration-(--duration-base) motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      <ul
        id={id}
        aria-label={t("label")}
        className={cn(
          "absolute left-0 z-50 flex min-w-full flex-col rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 transition-[opacity,translate,visibility] duration-(--duration-base) motion-reduce:transition-none",
          side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
          open
            ? "visible opacity-100"
            : cn("invisible opacity-0", side === "bottom" ? "-translate-y-1" : "translate-y-1"),
        )}
      >
        {routing.locales.map((l) => (
          <li key={l}>
            <button
              type="button"
              lang={l}
              aria-current={l === locale ? "true" : undefined}
              onClick={() => choose(l)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left whitespace-nowrap hover:bg-muted focus-visible:bg-muted focus-visible:outline-none aria-[current]:font-medium pointer-coarse:py-3"
            >
              {t(`locale.${l}`)}
              {l === locale && <Check aria-hidden className="size-4 text-gold-text" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
