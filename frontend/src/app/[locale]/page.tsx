import { AboutJeparla } from "@/components/home/about-jeparla";
import { CinematicHero } from "@/components/home/hero/cinematic-hero";
import {
  BecomeSeller,
  FeaturedStores,
  HomeCategories,
  MetalPrices,
  VerifiedExplainer,
} from "@/components/home/home-sections";
import { NewArrivals } from "@/components/home/new-arrivals";

// Home page: cinematic hero (#27), then the catalog sections.
export default function Home() {
  return (
    <>
      <CinematicHero />
      <HomeCategories />
      <NewArrivals />
      <MetalPrices />
      <VerifiedExplainer />
      <FeaturedStores />
      <BecomeSeller />
      <AboutJeparla />
    </>
  );
}
