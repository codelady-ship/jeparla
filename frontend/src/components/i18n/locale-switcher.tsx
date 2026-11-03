"use client";

import { Languages } from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition, type ChangeEvent } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

// Native <select>: keyboard and screen reader support for free, tiny bundle.
// Stays on the same page; next-intl stores the choice in the JEPARLA_LOCALE cookie.
export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as Locale;
    startTransition(() => {
      // pathname already has concrete segment values; params keep any query-less dynamic parts.
      router.replace(
        // @ts-expect-error -- pathnames are not typed (no `pathnames` in routing config)
        { pathname, params },
        { locale: next, scroll: false },
      );
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
        className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
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
