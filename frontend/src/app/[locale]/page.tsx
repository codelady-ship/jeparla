import { AboutJeparla } from "@/components/home/about-jeparla";
import { HomeContent } from "@/components/home/home-content";
import {
  BecomeSeller,
  FeaturedStores,
  HomeCategories,
  MetalPrices,
  VerifiedExplainer,
} from "@/components/home/home-sections";
import { NewArrivals } from "@/components/home/new-arrivals";

// Home page. The hero is a placeholder until the scroll hero (#27).
export default function Home() {
  return (
    <>
      <HomeContent />
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
