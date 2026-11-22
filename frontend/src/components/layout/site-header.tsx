import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { FavoritesPriceNote } from "@/components/saved/favorites-price-note";
import { SavedCount } from "@/components/saved/saved-count";
import { SearchLauncher } from "@/components/search/search-launcher";
import { AccountMenu } from "@/components/auth/account-menu";
import { Wordmark } from "@/components/brand/wordmark";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { HeaderMenu } from "./header-menu";
import { HeaderShell } from "./header-shell";
import { MobileNav } from "./mobile-nav";
import { NAV_GROUPS, NAV_ITEMS } from "./nav-items";

export function SiteHeader() {
  const t = useTranslations();
  const items = NAV_ITEMS.map((i) => ({ href: i.href, label: t(`Nav.${i.key}`) }));
  const groups = NAV_GROUPS.map((g) => ({
    key: g.key,
    title: t(`Nav.${g.key}`),
    links: g.links.map((l) => ({ href: l.href, label: t(l.label) })),
  }));
  const icon = buttonVariants({ variant: "ghost", size: "icon" });

  return (
    <HeaderShell>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t("Common.skipToContent")}
      </a>
      <div className="container-page flex h-16 items-center gap-1 min-[22.5rem]:gap-2">
        <MobileNav
          items={items}
          groups={groups}
          labels={{ menu: t("Nav.menu"), close: t("Common.close"), home: t("Nav.home") }}
        />
        <Link
          href="/"
          prefetch={false}
          translate="no"
          className="touch-target relative inline-flex items-center"
        >
          <Wordmark />
        </Link>
        <nav aria-label={t("Nav.mainNav")} className="ml-6 hidden lg:block xl:ml-8">
          <ul className="flex items-center gap-5 text-sm font-medium xl:gap-6">
            {items.map((item) => (
              <li key={item.href}>
                {/* No prefetch, like the other header links (#160): prefetching a route also
                    loads its client chunks, which pushed product pages past the script budget. */}
                <Link href={item.href} prefetch={false} className="link-underline py-1">
                  {item.label}
                </Link>
              </li>
            ))}
            {/* The whole bar shows from lg up; below that everything is in the menu sheet. */}
            {groups.map((g) => (
              <HeaderMenu key={g.key} label={g.title} links={g.links} />
            ))}
          </ul>
        </nav>
        {/* 320px phones: no gaps between the icons, so the row fits without sideways scroll. */}
        <div className="ml-auto flex items-center min-[22.5rem]:gap-1">
          <SearchLauncher
            labels={{
              open: t("Search.open"),
              title: t("Search.title"),
              placeholder: t("Search.placeholder"),
              recent: t("Search.recent"),
              clearRecent: t("Search.clearRecent"),
              stores: t("Search.stores"),
              categories: t("Search.categories"),
              products: t("Search.products"),
              loading: t("Search.loading"),
              empty: t("Search.empty"),
              error: t("Search.error"),
              seeAll: t.raw("Search.seeAll") as string,
              results: t.raw("Search.results") as string,
              close: t("Common.close"),
              photo: {
                open: t("Search.photo.open"),
                back: t("Search.photo.back"),
                title: t("Search.photo.title"),
                hint: t("Search.photo.hint"),
                pick: t("Search.photo.pick"),
                camera: t("Search.photo.camera"),
                drop: t("Search.photo.drop"),
                searching: t("Search.photo.searching"),
                results: t("Search.photo.results"),
                empty: t("Search.photo.empty"),
                notConfigured: t("Search.photo.notConfigured"),
                aiBadge: t("Search.photo.aiBadge"),
                fashionBadge: t("Product.fashionBadge"),
                crop: {
                  title: t("Search.photo.crop.title"),
                  hint: t("Search.photo.crop.hint"),
                  frame: t("Search.photo.crop.frame"),
                  search: t("Search.photo.crop.search"),
                  whole: t("Search.photo.crop.whole"),
                },
                filters: {
                  title: t("Catalog.filters"),
                  category: t("Catalog.category"),
                  allCategories: t("Catalog.allCategories"),
                  metal: t("Catalog.metal"),
                  any: t("Catalog.any"),
                  fineness: t("Catalog.fineness"),
                  price: t("Catalog.price"),
                  min: t("Catalog.min"),
                  max: t("Catalog.max"),
                  store: t("Catalog.store"),
                  city: t("Catalog.city"),
                  anyCity: t("Catalog.anyCity"),
                  apply: t("Catalog.apply"),
                  clear: t("Catalog.clearAll"),
                  empty: t("Search.photo.filtersEmpty"),
                },
                metals: {
                  GOLD: t("Product.metal.GOLD"),
                  SILVER: t("Product.metal.SILVER"),
                  PLATINUM: t("Product.metal.PLATINUM"),
                },
                errors: {
                  "search.image_not_configured": t("Search.photo.notConfigured"),
                  "search.image_size": t("Search.photo.errors.size"),
                  "search.image_type": t("Search.photo.errors.type"),
                  "search.image_unreadable": t("Search.photo.errors.unreadable"),
                  rate_limited: t("Search.photo.errors.rateLimited"),
                  generic: t("Search.photo.errors.generic"),
                },
              },
            }}
          />
          {/* Header links are on every page: no prefetch during the first load (#160). */}
          <Link href="/favorites" prefetch={false} className={`${icon} relative`}>
            <Heart aria-hidden />
            <span className="sr-only">{t("Nav.favorites")}</span>
            <SavedCount list="favorites" />
            <FavoritesPriceNote />
          </Link>
          <div className="hidden sm:block lg:hidden">
            <LocaleSwitcher />
          </div>
          <ThemeToggle
            labels={{ toDark: t("Common.themeToDark"), toLight: t("Common.themeToLight") }}
          />
          <AccountMenu
            labels={{
              login: t("Nav.login"),
              account: t("Nav.account"),
              dashboard: t("Nav.dashboard"),
              favorites: t("Nav.favorites"),
              myAccount: t("Nav.myAccount"),
              logout: t("Nav.logout"),
            }}
          />
        </div>
      </div>
    </HeaderShell>
  );
}
