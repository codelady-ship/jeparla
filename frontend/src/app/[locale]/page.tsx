import { AboutJeparla } from "@/components/home/about-jeparla";
import { CinematicHero } from "@/components/home/hero/cinematic-hero";
import {
  BecomeSeller,
  BudgetPicks,
  FeaturedStores,
  HomeCategories,
  MetalPrices,
  VerifiedExplainer,
} from "@/components/home/home-sections";
import { NewArrivals } from "@/components/home/new-arrivals";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { openGraph } from "@/lib/seo/open-graph";

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  return { openGraph: openGraph(locale) };
}

// Home page in an editorial rhythm: full-bleed film, then a split band, alternating.
// Hero (model scenes, film) -> categories (deep green: links + close-ups) -> new
// arrivals (pieces | hand close-up) -> ring film (checks) -> budgets (deep green:
// links + tilt ring) -> stores banner and cards -> metal prices -> seller film
// ("open your store") -> about and FAQ.
export default function Home() {
  return (
    <>
      <CinematicHero />
      <HomeCategories />
      <NewArrivals />
      <VerifiedExplainer />
      <BudgetPicks />
      <FeaturedStores />
      <MetalPrices />
      <BecomeSeller />
      <AboutJeparla />
    </>
  );
}
