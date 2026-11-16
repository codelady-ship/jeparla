import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { FavoritesPriceNote } from "@/components/saved/favorites-price-note";
import { SavedCount } from "@/components/saved/saved-count";
import { SearchLauncher } from "@/components/search/search-launcher";
import { AccountMenu } from "@/components/auth/account-menu";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { HeaderShell } from "./header-shell";
import { MobileNav } from "./mobile-nav";
import { NAV_ITEMS } from "./nav-items";

export function SiteHeader() {
  const t = useTranslations();
  const items = NAV_ITEMS.map((i) => ({ href: i.href, label: t(`Nav.${i.key}`) }));
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
          labels={{ menu: t("Nav.menu"), close: t("Common.close"), home: t("Nav.home") }}
        />
        <Link
          href="/"
          prefetch={false}
          translate="no"
          className="touch-target relative font-heading text-2xl font-semibold tracking-tight"
        >
          Jeparla
        </Link>
        <nav aria-label={t("Nav.mainNav")} className="ml-8 hidden md:block">
          <ul className="flex items-center gap-6 text-sm font-medium">
            {items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="link-underline py-1">
                  {item.label}
                </Link>
              </li>
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
          <div className="hidden sm:block">
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
