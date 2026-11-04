import { FavoritesView } from "@/components/saved/favorites-view";
import { SavedPage, savedMetadata } from "@/components/saved/saved-page";

export const generateMetadata = () => savedMetadata("favorites");

export default function FavoritesPage() {
  return (
    <SavedPage kind="favorites">
      <FavoritesView />
    </SavedPage>
  );
}
