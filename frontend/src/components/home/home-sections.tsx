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
import { revealStep } from "@/lib/motion/reveal-step";
import { cn } from "cn";
import { GHOST_PILL_DARK } from "./pills";
import { StickyVideoSection } from "./sticky-video-section";

/*
 * Home sections below the hero. Rhythm: full-bleed film bands alternate with
 * 1200px sections (text-left / picture-right splits and three-card grids), 72px
 * apart. One gold pill per section for the main action, ghost pills for the rest.
 * Motion (<Reveal>, none under reduced motion): in a split the copy comes in from the
 * left line by line and the picture from the right, opening like a window; cards rise
 * one after another. Film sections (<StickyVideoSection>: checks, stores, seller) pin
 * their film behind the content, which scrolls over it; the next section covers it.
 */

/**
 * Large, quiet links on the deep green bands (categories, budgets). At least 44px tall
 * for a finger (min-h-11); the list has no gap, so the rhythm matches the text size.
 */
const BAND_LINK =
  "home-head inline-flex min-h-11 items-center py-1 font-heading text-3xl text-scene-ivory transition-colors duration-200 hover:text-scene-gold focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-scene-gold sm:text-4xl lg:text-5xl";

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
 * Categories: a list of large links over a film of jewellery in a showcase (stock,
 * decorative), pinned behind them like the film sections below. The links come in from
 * the left as they scroll into view ([data-drift]).
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
    <Reveal
      as="section"
      from="film"
      aria-labelledby="home-categories"
      className="sticky-film"
      data-sticky-film=""
    >
      <div className="sticky-film-stage" data-sticky-film-stage="">
        <AmbientVideo
          desktop={SHOWCASE_VIDEO.desktop}
          mobile={SHOWCASE_VIDEO.mobile}
          controls={{ pause: tv("pause"), play: tv("play") }}
          className="bg-scene-green"
        />
        <div aria-hidden className="sticky-film-scrim" />
        <div aria-hidden className="sticky-film-shade" />
      </div>
      <div className="sticky-film-content">
        <div className="sticky-film-lead home-wrap">
          <div className="flex flex-col items-start text-scene-ivory">
            <h2 id="home-categories" className={BAND_HEAD} data-drift="left">
              {t("categories")}
            </h2>
            <ul className="flex flex-col">
              {roots.map((c) => (
                <li key={c.slug} data-drift="left">
                  <Link href={`/categories/${c.slug}`} className={BAND_LINK}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-10" data-drift="left">
              <Link href="/categories" className={GHOST_PILL_DARK}>
                {t("seeAll")}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
            <p className="mt-6 max-w-md text-xs text-scene-ivory" data-drift="left">
              {t("decorNote")}
            </p>
          </div>
        </div>
      </div>
    </Reveal>
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
        <Reveal from="left" stagger>
          <h2 id="home-budget" className={BAND_HEAD} {...revealStep(0)}>
            {t("budget.title")}
          </h2>
          <ul className="flex flex-col">
            {budgets.map((max, i) => (
              <li key={max} {...revealStep(i + 1)}>
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
          <p
            className="mt-8 max-w-md text-sm text-scene-ivory-muted"
            {...revealStep(budgets.length + 1)}
          >
            {t("budget.note")}
          </p>
        </Reveal>
        {/* Decorative: a drawn ring that turns toward the pointer (our own SVG, #260). */}
        <Reveal from="right" index={1} className="md:w-full md:max-w-md md:justify-self-end">
          <TiltRing className="reveal-frame aspect-[16/9] rounded-xl md:aspect-[4/5]" />
        </Reveal>
      </div>
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
  // A decorative interior (stock) pinned behind the copy and the cards; never one of
  // the listed stores (the note says so).
  return (
    <StickyVideoSection
      id="home-stores"
      title={t("storesBanner.title")}
      text={t("storesBanner.text")}
      cta={{ href: "/stores", label: t("storesBanner.cta") }}
      video={VITRINE_HOME}
      note={t("decorNote")}
      after={
        <Reveal as="ul" stagger data-store-cards="" className="home-wrap grid gap-4 md:grid-cols-3">
          {featured.map((s) => (
            // A solid ground under the card: its hover tint is translucent, and here the
            // film is behind it, not the page.
            <li key={s.id} data-reveal-item="" data-drift="up" className="rounded-lg bg-card">
              <StoreCard store={s} />
            </li>
          ))}
        </Reveal>
      }
    />
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
    <StickyVideoSection
      id="home-verified"
      title={t("ringBand.title")}
      text={t("verifiedText")}
      cta={{ href: "/products", label: t("ringBand.cta") }}
      video={RING_VIDEO}
      note={t("decorNote")}
      after={
        // The three checks side by side from tablet width up, stacked on phones (#287).
        <Reveal as="ul" stagger data-checks="" className="home-wrap grid gap-4 md:grid-cols-3">
          {items.map(({ key, Icon }) => (
            <li
              key={key}
              data-reveal-item=""
              data-drift="up"
              className="home-card flex flex-col gap-3"
            >
              <Icon aria-hidden className="size-7 text-gold-text" />
              <h3 className="home-head font-heading text-2xl">{t(`verified.${key}.title`)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`verified.${key}.text`)}
              </p>
            </li>
          ))}
        </Reveal>
      }
    />
  );
}

/**
 * Daily CBAR gram prices and the 30-day chart (PLAN 5.10). Full width on the page
 * ground: it scrolls over the pinned stores film before it and covers it.
 */
export function MetalPrices() {
  return (
    <div className="bg-background">
      <Reveal className="home-wrap home-pad">
        <MetalPriceWidget />
      </Reveal>
    </div>
  );
}

export async function BecomeSeller() {
  const t = await getTranslations("Home");
  return (
    <StickyVideoSection
      id="home-seller"
      title={t("sellerTitle")}
      text={t("sellerText")}
      cta={{ href: "/sell", label: t("sellerCta") }}
      video={ATELIER_VIDEO}
      note={t("decorNote")}
    />
  );
}
