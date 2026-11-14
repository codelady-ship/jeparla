import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { Link } from "@/i18n/navigation";

// Link targets are placeholders until their pages exist (#12, #14, #61, #56).
const COLUMNS = [
  {
    title: "about",
    links: [
      { href: "/about", label: "Footer.aboutUs" },
      { href: "/contact", label: "Footer.contact" },
      { href: "/help", label: "Footer.help" },
    ],
  },
  {
    title: "buyers",
    links: [
      { href: "/products", label: "Nav.catalog" },
      { href: "/stores", label: "Nav.stores" },
      { href: "/prices", label: "Footer.metalPrices" },
      { href: "/size-guide", label: "Footer.sizeGuide" },
      { href: "/calculator", label: "Footer.calculator" },
    ],
  },
  {
    title: "sellers",
    links: [
      { href: "/sell", label: "Footer.openStore" },
      { href: "/merchant", label: "Footer.merchantCabinet" },
    ],
  },
  {
    title: "legal",
    links: [
      { href: "/legal/privacy", label: "Footer.privacy" },
      { href: "/legal/terms", label: "Footer.terms" },
      { href: "/legal/cookies", label: "Footer.cookies" },
    ],
  },
] as const;

export function SiteFooter() {
  const t = useTranslations();

  return (
    // While the install card is open, the page ends with room for it (set by InstallPrompt).
    <footer className="mt-auto border-t bg-surface pb-[var(--install-card-space,0px)]">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div className="flex flex-col items-start gap-3">
          <p translate="no" className="font-heading text-2xl font-semibold">
            Jeparla
          </p>
          <p className="max-w-xs text-sm text-muted-foreground">{t("Footer.tagline")}</p>
          <LocaleSwitcher />
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={t(`Footer.${col.title}`)}>
            <h2 className="mb-3 font-sans text-sm font-semibold">{t(`Footer.${col.title}`)}</h2>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground pointer-coarse:gap-0">
              {col.links.map((l) => (
                <li key={l.href}>
                  {/* Most footer routes arrive later; no prefetch keeps 404s out. */}
                  <Link
                    href={l.href}
                    prefetch={false}
                    className="link-underline hover:text-foreground pointer-coarse:inline-block pointer-coarse:min-w-11 pointer-coarse:py-3"
                  >
                    {t(l.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <p className="container-page py-4 text-xs text-muted-foreground">{t("Footer.rights")}</p>
      </div>
    </footer>
  );
}
