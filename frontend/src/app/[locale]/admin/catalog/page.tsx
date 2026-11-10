import { AdminPage } from "@/components/admin/admin-page";
import { AdminIntl, adminMetadata } from "@/components/admin/admin-shell";
import { CatalogSettings } from "@/components/admin/catalog-settings";
import { adminContext } from "@/lib/admin/server";

export const generateMetadata = () => adminMetadata("catalog");

async function Settings() {
  const { api } = await adminContext();
  const [categories, finenesses, synonyms] = await Promise.all([
    api.categories(),
    api.finenesses(),
    api.synonyms(),
  ]);
  return (
    <AdminIntl>
      <CatalogSettings categories={categories} finenesses={finenesses} synonyms={synonyms} />
    </AdminIntl>
  );
}

export default function Page() {
  return (
    <AdminPage page="catalog" sampleOnly>
      <Settings />
    </AdminPage>
  );
}
