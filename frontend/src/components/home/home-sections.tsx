import { ArrowRight, BadgeCheck, FileCheck2, Microscope, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { MetalPriceWidget } from "@/components/metal/metal-price-widget";
import { CategoryTiles } from "@/components/categories/category-tiles";
import { AmbientVideo } from "@/components/media/ambient-video";
import { ATELIER_VIDEO, RING_VIDEO, VITRINE_HOME } from "@/components/media/stock-media";
import { Reveal } from "@/components/motion/reveal";
import { TiltRing } from "@/components/motion/tilt-ring";
import { StoreCard } from "@/components/stores/store-card";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cn } from "cn";

function SectionHead({ id, title, link }: { id: string; title: string; link?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 id={id} className="text-2xl sm:text-3xl">
        {title}
      </h2>
      {link}
    </div>
  );
}

function SeeAll({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="touch-target relative inline-flex items-center gap-1 link-underline text-sm font-medium"
    >
      {children}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

const WRAP = "container-page";

export async function HomeCategories() {
  const [t, categories] = await Promise.all([getTranslations("Home"), api.listCategories()]);
  const roots = categories.filter((c) => c.parentId === null).slice(0, 8);
  return (
    <section aria-labelledby="home-categories" className={cn(WRAP, "pb-16")}>
      <SectionHead
        id="home-categories"
        title={t("categories")}
        link={<SeeAll href="/categories">{t("seeAll")}</SeeAll>}
      />
      <CategoryTiles categories={roots} reveal={false} />
    </section>
  );
}

/** Budget entry points in AZN (#115); each opens the catalogue filtered by maximum price. */
const BUDGETS = [200, 500, 1000, 3000] as const;

export async function BudgetPicks() {
  const [t, pages] = await Promise.all([
    getTranslations("Home"),
    Promise.all(BUDGETS.map((max) => api.listProducts({ maxPrice: String(max), size: 1 }))),
  ]);
  // A budget with nothing under it is not offered.
  const budgets = BUDGETS.filter((_, i) => pages[i].totalElements > 0);
  if (budgets.length === 0) return null;
  return (
    <section
      aria-labelledby="home-budget"
      className={cn(
        WRAP,
        "grid gap-8 pb-16 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:items-center md:gap-12",
      )}
    >
      <div>
        <SectionHead id="home-budget" title={t("budget.title")} />
        <ul className="flex flex-wrap gap-2">
          {budgets.map((max) => (
            <li key={max}>
              <Link
                href={`/products?maxPrice=${max}`}
                prefetch={false}
                className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium tabular-nums transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:h-11"
              >
                {t("budget.upTo", { amount: max })}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">{t("budget.note")}</p>
      </div>
      {/* Decorative: a drawn ring that turns toward the pointer (our own SVG, #260). */}
      <TiltRing className="aspect-[16/9] rounded-xl md:aspect-[4/3]" />
    </section>
  );
}

export async function FeaturedStores() {
  const [t, stores] = await Promise.all([getTranslations("Home"), api.listStores()]);
  // Checked stores first; no paid placement exists, so the order says nothing else.
  const rank = (s: (typeof stores)[number]) =>
    Number(s.verification.seller === "VERIFIED") + Number(s.verification.documents === "VERIFIED");
  const featured = [...stores].sort((a, b) => rank(b) - rank(a)).slice(0, 3);
  if (featured.length === 0) return null;
  return (
    <section aria-labelledby="home-stores" className={cn(WRAP, "pb-16")}>
      {/* Decorative interior (stock), never one of the listed stores: see the note below it. */}
      <figure className="mb-6">
        <div className="relative isolate flex min-h-[28rem] items-end overflow-hidden rounded-xl bg-scene-green md:aspect-[12/5] md:min-h-0">
          <AmbientVideo desktop={VITRINE_HOME.desktop} mobile={VITRINE_HOME.mobile} />
          <div aria-hidden className="scene-scrim absolute inset-0" />
          <div className="relative flex flex-col gap-3 p-5 text-scene-ivory sm:p-8 md:max-w-xl md:p-10">
            <h2 id="home-stores" className="text-3xl text-balance sm:text-4xl md:text-5xl">
              {t("storesBanner.title")}
            </h2>
            <p className="max-w-md text-sm text-pretty sm:text-base">{t("storesBanner.text")}</p>
            <Link
              href="/stores"
              className={cn(
                buttonVariants({ variant: "gold", size: "lg" }),
                "mt-2 h-11 self-start px-5",
              )}
            >
              {t("storesBanner.cta")}
            </Link>
          </div>
        </div>
        <figcaption className="mt-2 text-xs text-muted-foreground">{t("decorNote")}</figcaption>
      </figure>
      <ul className="grid gap-4 md:grid-cols-3">
        {featured.map((s, i) => (
          <Reveal key={s.id} as="li" index={i}>
            <StoreCard store={s} />
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

export async function VerifiedExplainer() {
  const t = await getTranslations("Home");
  const items = [
    { key: "seller", Icon: BadgeCheck },
    { key: "documents", Icon: FileCheck2 },
    { key: "expertise", Icon: Microscope },
  ] as const;
  return (
    <section aria-labelledby="home-verified" className="mb-16 border-y bg-card">
      <div
        className={cn(
          WRAP,
          "grid gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-center lg:gap-16",
        )}
      >
        <div>
          <h2 id="home-verified" className="mb-2 text-2xl sm:text-3xl">
            {t("verifiedTitle")}
          </h2>
          <p className="mb-10 max-w-2xl text-muted-foreground">{t("verifiedText")}</p>
          <ul className="grid gap-8 md:grid-cols-3 lg:grid-cols-1 lg:gap-6">
            {items.map(({ key, Icon }, i) => (
              <Reveal key={key} as="li" index={i} className="flex flex-col gap-2">
                <Icon aria-hidden className="size-7 text-gold-text" />
                <h3 className="font-sans text-lg font-semibold">{t(`verified.${key}.title`)}</h3>
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {t(`verified.${key}.text`)}
                </p>
              </Reveal>
            ))}
          </ul>
        </div>
        {/* A close look is what an expert check is about; the clip is stock, not a listed item. */}
        <figure>
          <div className="relative isolate aspect-square overflow-hidden rounded-xl bg-scene-green sm:aspect-[4/5]">
            <AmbientVideo
              desktop={RING_VIDEO.desktop}
              mobile={RING_VIDEO.mobile}
              desktopQuery="(min-width: 64rem)"
            />
          </div>
          <figcaption className="mt-2 text-xs text-muted-foreground">{t("decorNote")}</figcaption>
        </figure>
      </div>
    </section>
  );
}

/** Daily CBAR gram prices and the 30-day chart (PLAN 5.10). */
export function MetalPrices() {
  return (
    <div className={cn(WRAP, "pb-16")}>
      <MetalPriceWidget />
    </div>
  );
}

export async function BecomeSeller() {
  const t = await getTranslations("Home");
  return (
    <section
      aria-labelledby="home-seller"
      className="relative isolate overflow-hidden bg-scene-deep text-scene-ivory"
    >
      <AmbientVideo desktop={ATELIER_VIDEO.desktop} mobile={ATELIER_VIDEO.mobile} />
      <div aria-hidden className="scene-scrim scene-scrim--end absolute inset-0" />
      <div
        className={cn(
          WRAP,
          "relative flex min-h-[34rem] flex-col justify-end py-12 md:min-h-[38rem] md:justify-center md:py-20",
        )}
      >
        <Reveal className="flex max-w-xl flex-col items-start gap-4 md:ml-auto md:max-w-md lg:max-w-lg">
          <Store aria-hidden className="size-8 text-scene-gold" />
          <h2 id="home-seller" className="text-4xl text-balance sm:text-5xl lg:text-6xl">
            {t("sellerTitle")}
          </h2>
          <p className="max-w-md text-pretty sm:text-lg">{t("sellerText")}</p>
          <Link
            href="/sell"
            prefetch={false}
            className={cn(buttonVariants({ variant: "gold", size: "lg" }), "mt-2 h-11 px-5")}
          >
            {t("sellerCta")}
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
