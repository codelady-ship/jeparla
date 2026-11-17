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

// Home page: cinematic hero (#27), then the catalog sections. The picture-led blocks
// (stores banner, ring close-up, seller film) are kept apart by text sections, and the
// seller call to action closes the page as a full-width film.
export default function Home() {
  return (
    <>
      <CinematicHero />
      <HomeCategories />
      <BudgetPicks />
      <NewArrivals />
      <FeaturedStores />
      <MetalPrices />
      <VerifiedExplainer />
      <AboutJeparla />
      <BecomeSeller />
    </>
  );
}
