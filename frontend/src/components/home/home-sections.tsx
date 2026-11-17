import { ArrowRight, BadgeCheck, FileCheck2, Microscope } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { MetalPriceWidget } from "@/components/metal/metal-price-widget";
import { AmbientVideo } from "@/components/media/ambient-video";
import {
  ATELIER_VIDEO,
  RING_VIDEO,
  SHOWCASE_VIDEO,
  VITRINE_HOME,
} from "@/components/media/stock-media";
import { Reveal } from "@/components/motion/reveal";
import { TiltRing } from "@/components/motion/tilt-ring";
import { StoreCard } from "@/components/stores/store-card";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cn } from "cn";
import { GHOST_PILL_DARK, PRIMARY_PILL } from "./pills";
import { VideoBand } from "./video-band";

/*
 * Home sections below the hero. Rhythm: full-bleed film bands alternate with
 * 1200px sections (text-left / picture-right splits and three-card grids), 72px
 * apart. One gold pill per section for the main action, ghost pills for the rest;
 * every block arrives with a calm fade and rise (<Reveal>, none under reduced motion).
 */

/** Large, quiet links on the deep green bands (categories, budgets). */
const BAND_LINK =
  "home-head inline-flex items-baseline py-1 font-heading text-3xl text-scene-ivory transition-colors duration-200 hover:text-scene-gold focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-scene-gold sm:text-4xl lg:text-5xl";

/** Small band heading over a link list. */
const BAND_HEAD = "home-head mb-6 text-xl text-scene-ivory-muted sm:text-2xl";

/**
 * Top-level categories shown while the catalogue has no taxonomy yet (the live API
 * returned none): the block never shows an empty heading. Slugs match the seed.
 */
const FALLBACK_CATEGORIES = [
  "uzukler",
  "sirgalar",
  "boyunbagilar",
  "qolbaqlar",
  "asqilar",
  "destler",
] as const;

/**
 * Categories: a list of large links on deep green, a film of jewellery in a showcase
 * beside it (stock, decorative). The links are the content; the film sets the tone.
 */
export async function HomeCategories() {
  const [t, tv, categories, locale] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Home.video"),
    api.listCategories().catch(() => []),
    getLocale(),
  ]);
  const fromApi = categories
    .filter((c) => c.parentId === null)
    .slice(0, 6)
    .map((c) => ({ slug: c.slug, name: c.name[locale as "az"] }));
  const roots =
    fromApi.length > 0
      ? fromApi
      : FALLBACK_CATEGORIES.map((slug) => ({ slug, name: t(`categoryFallback.${slug}`) }));
  return (
    <section aria-labelledby="home-categories" className="bg-scene-green text-scene-ivory">
      <div className="home-wrap home-pad grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-16">
        <Reveal>
          <h2 id="home-categories" className={BAND_HEAD}>
            {t("categories")}
          </h2>
          <ul className="flex flex-col gap-1">
            {roots.map((c) => (
              <li key={c.slug}>
                <Link href={`/categories/${c.slug}`} className={BAND_LINK}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/categories" className={cn(GHOST_PILL_DARK, "mt-10")}>
            {t("seeAll")}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Reveal>
        <Reveal as="figure" index={1} className="md:w-full md:max-w-md md:justify-self-end">
          <div className="video-panel relative isolate aspect-[4/5] overflow-hidden rounded-xl bg-scene-deep">
            <AmbientVideo
              desktop={SHOWCASE_VIDEO.desktop}
              mobile={SHOWCASE_VIDEO.mobile}
              controls={{ pause: tv("pause"), play: tv("play") }}
            />
          </div>
          <figcaption className="mt-3 text-xs text-scene-ivory-muted">{t("decorNote")}</figcaption>
        </Reveal>
      </div>
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
    <section aria-labelledby="home-budget" className="bg-scene-green text-scene-ivory">
      <div className="home-wrap home-pad grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-16">
        <Reveal>
          <h2 id="home-budget" className={BAND_HEAD}>
            {t("budget.title")}
          </h2>
          <ul className="flex flex-col gap-1">
            {budgets.map((max) => (
              <li key={max}>
                <Link
                  href={`/products?maxPrice=${max}`}
                  prefetch={false}
                  className={cn(BAND_LINK, "tabular-nums")}
                >
                  {t("budget.upTo", { amount: max })}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-md text-sm text-scene-ivory-muted">{t("budget.note")}</p>
        </Reveal>
        {/* Decorative: a drawn ring that turns toward the pointer (our own SVG, #260). */}
        <Reveal index={1} className="md:w-full md:max-w-md md:justify-self-end">
          <TiltRing className="aspect-[16/9] rounded-xl md:aspect-[4/5]" />
        </Reveal>
      </div>
    </section>
  );
}

export async function FeaturedStores() {
  const [t, tv, stores] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Home.video"),
    api.listStores(),
  ]);
  // Checked stores first; no paid placement exists, so the order says nothing else.
  const rank = (s: (typeof stores)[number]) =>
    Number(s.verification.seller === "VERIFIED") + Number(s.verification.documents === "VERIFIED");
  const featured = [...stores].sort((a, b) => rank(b) - rank(a)).slice(0, 3);
  if (featured.length === 0) return null;
  return (
    <section aria-labelledby="home-stores" className="home-wrap home-pad">
      {/* Decorative interior (stock), never one of the listed stores: see the note below it. */}
      <Reveal as="figure" className="mb-8">
        <div className="video-panel relative isolate flex min-h-[28rem] items-end overflow-hidden rounded-xl bg-scene-green md:aspect-[12/5] md:min-h-0">
          <AmbientVideo
            desktop={VITRINE_HOME.desktop}
            mobile={VITRINE_HOME.mobile}
            controls={{ pause: tv("pause"), play: tv("play") }}
          />
          <div aria-hidden className="scene-scrim absolute inset-0" />
          <div className="relative flex flex-col gap-4 p-8 text-scene-ivory md:max-w-xl md:p-10">
            <h2
              id="home-stores"
              className="home-head text-3xl text-balance sm:text-4xl md:text-5xl"
            >
              {t("storesBanner.title")}
            </h2>
            <p className="max-w-md text-sm text-pretty sm:text-base">{t("storesBanner.text")}</p>
            <Link href="/stores" className={cn(PRIMARY_PILL, "mt-2 self-start")}>
              {t("storesBanner.cta")}
            </Link>
          </div>
        </div>
        <figcaption className="mt-2 text-xs text-muted-foreground">{t("decorNote")}</figcaption>
      </Reveal>
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
  // A close look is what an expert check is about; the clip is stock, not a listed item.
  return (
    <VideoBand
      id="home-verified"
      title={t("ringBand.title")}
      text={t("verifiedText")}
      cta={{ href: "/products", label: t("ringBand.cta") }}
      video={RING_VIDEO}
      note={t("decorNote")}
      after={
        <ul className="home-wrap home-pad grid gap-4 md:grid-cols-3">
          {items.map(({ key, Icon }, i) => (
            <Reveal key={key} as="li" index={i} className="home-card flex flex-col gap-3">
              <Icon aria-hidden className="size-7 text-gold-text" />
              <h3 className="home-head font-heading text-2xl">{t(`verified.${key}.title`)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`verified.${key}.text`)}
              </p>
            </Reveal>
          ))}
        </ul>
      }
    />
  );
}

/** Daily CBAR gram prices and the 30-day chart (PLAN 5.10). */
export function MetalPrices() {
  return (
    <div className="home-wrap pb-12 md:pb-[4.5rem]">
      <MetalPriceWidget />
    </div>
  );
}

export async function BecomeSeller() {
  const t = await getTranslations("Home");
  return (
    <VideoBand
      id="home-seller"
      title={t("sellerTitle")}
      text={t("sellerText")}
      cta={{ href: "/sell", label: t("sellerCta") }}
      video={ATELIER_VIDEO}
      note={t("decorNote")}
    />
  );
}
