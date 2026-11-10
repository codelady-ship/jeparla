"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition, type ChangeEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { stripLocale } from "@/i18n/strip-locale";

// Native <select>: keyboard and screen reader support for free, tiny bundle.
// The URL is read only when the user switches, not during render, so the header
// and footer stay part of the static shell. next-intl stores the choice in a cookie.
export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as Locale;
    const href = stripLocale(window.location.pathname, window.location.search);
    startTransition(() => {
      router.replace(href, { locale: next, scroll: false });
    });
  }

  return (
    <label className="relative inline-flex items-center gap-1.5 text-sm">
      <Languages aria-hidden className="size-4 text-muted-foreground" />
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        onChange={onChange}
        disabled={isPending}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 pointer-coarse:h-11"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {t(`locale.${l}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
