import { AdminPage } from "@/components/admin/admin-page";
import { AdminIntl, adminMetadata } from "@/components/admin/admin-shell";
import { PhotoFitList } from "@/components/admin/photo-fit-list";

export const generateMetadata = () => adminMetadata("photos");

/** Fit product photos to the design (cut out, cream background, card frame) on this device. */
export default function Page() {
  return (
    <AdminPage page="photos">
      <AdminIntl>
        <PhotoFitList />
      </AdminIntl>
    </AdminPage>
  );
}
