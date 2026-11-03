import { Heart, Search, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
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
          {/* prefetch off until these routes exist (#18, #24); prefetching them 404s. */}
          <Link href="/search" prefetch={false} className={icon} aria-label={t("Nav.search")}>
            <Search aria-hidden />
          </Link>
          <Link href="/favorites" prefetch={false} className={icon} aria-label={t("Nav.favorites")}>
            <Heart aria-hidden />
          </Link>
          <div className="hidden sm:block">
            <LocaleSwitcher />
          </div>
          <ThemeToggle
            labels={{ toDark: t("Common.themeToDark"), toLight: t("Common.themeToLight") }}
          />
          <Link href="/login" prefetch={false} className={icon} aria-label={t("Nav.login")}>
            <UserRound aria-hidden />
          </Link>
        </div>
      </div>
    </HeaderShell>
  );
}
