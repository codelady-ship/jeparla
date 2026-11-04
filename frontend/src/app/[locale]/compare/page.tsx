import { CompareView } from "@/components/saved/compare-view";
import { SavedPage, savedMetadata } from "@/components/saved/saved-page";

export const generateMetadata = () => savedMetadata("compare");

export default function ComparePage() {
  return (
    <SavedPage kind="compare">
      <CompareView />
    </SavedPage>
  );
}
