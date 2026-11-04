import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
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
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <MobileNav
          items={items}
          labels={{ menu: t("Nav.menu"), close: t("Common.close"), home: t("Nav.home") }}
        />
        <Link
          href="/"
          translate="no"
          className="font-heading text-2xl font-semibold tracking-tight"
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
        <div className="ml-auto flex items-center gap-1">
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
            }}
          />
          <Link href="/favorites" className={`${icon} relative`}>
            <Heart aria-hidden />
            <span className="sr-only">{t("Nav.favorites")}</span>
            <SavedCount list="favorites" />
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
              logout: t("Nav.logout"),
            }}
          />
        </div>
      </div>
    </HeaderShell>
  );
}
