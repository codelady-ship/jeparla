import { AboutJeparla } from "@/components/home/about-jeparla";
import { HomeContent } from "@/components/home/home-content";
import { NewArrivals } from "@/components/home/new-arrivals";

// Home page. The remaining sections come with issue #15, the scroll hero with #27.
export default function Home() {
  return (
    <>
      <HomeContent />
      <NewArrivals />
      <AboutJeparla />
    </>
  );
}
