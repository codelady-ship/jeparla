import { Search, Store } from "lucide-react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { FilterForm } from "@/components/catalog/filter-form";
import { Reveal } from "@/components/motion/reveal";
import { IntlProvider } from "@/components/i18n/intl-provider";
import { JsonLd } from "@/components/seo/json-ld";
import { itemList } from "@/lib/seo/json-ld";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api";
import type { SearchParams } from "@/lib/catalog/filters";
import { normalizeNear } from "@/lib/geo/near";
import { NearMeButton } from "./near-me-button";
import { StoreCard } from "./store-card";

const field =
  "h-10 pointer-coarse:h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export async function StoreList({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  const q = one(sp.q)?.slice(0, 80);
  const city = one(sp.city)?.slice(0, 60);
  const near = normalizeNear(one(sp.near)) ?? undefined;
  const [t, locale, messages, all, stores] = await Promise.all([
    getTranslations("Stores"),
    getLocale(),
    getMessages(),
    api.listStores(),
    api.listStores({ q, city, near }),
  ]);
  const cities = [...new Set(all.map((s) => s.city))].sort((a, b) => a.localeCompare(b, locale));

  return (
    <div className="flex flex-col gap-6">
      <JsonLd
        data={[
          itemList(
            t("title"),
            stores.map((s) => ({ name: s.name, path: `/${locale}/stores/${s.slug}` })),
          ),
        ]}
      />
      <FilterForm action="/stores" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {near && <input type="hidden" name="near" value={near} />}
        <label className="flex flex-1 flex-col gap-1 text-sm">
          {t("searchLabel")}
          <span className="relative">
            <Search
              aria-hidden
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input type="search" name="q" defaultValue={q} className={`${field} w-full pl-9`} />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("city")}
          <select name="city" defaultValue={city ?? ""} className={field}>
            <option value="">{t("allCities")}</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="h-10 pointer-coarse:h-11">
          {t("search")}
        </Button>
      </FilterForm>

      {/* A Client Component: only the near* labels go to the browser (the layout sends none). */}
      <IntlProvider
        locale={locale as Locale}
        messages={{
          Stores: Object.fromEntries(
            Object.entries(messages.Stores).filter(([k]) => k.startsWith("near")),
          ),
        }}
      >
        <NearMeButton q={q} city={city} near={near} />
      </IntlProvider>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("count", { count: stores.length })}
      </p>

      {stores.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
          <Store aria-hidden className="size-8 text-muted-foreground" />
          <h2 className="text-xl">{t("emptyTitle")}</h2>
          <Link href="/stores" className="link-underline text-sm font-medium">
            {t("showAll")}
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s, i) =>
            i < 6 ? (
              <li key={s.id}>
                <StoreCard store={s} />
              </li>
            ) : (
              <Reveal key={s.id} as="li" index={i % 3}>
                <StoreCard store={s} />
              </Reveal>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
