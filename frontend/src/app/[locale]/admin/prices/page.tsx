import { AdminPage } from "@/components/admin/admin-page";
import { AdminIntl, adminMetadata } from "@/components/admin/admin-shell";
import { MetalPrices } from "@/components/admin/metal-prices";
import { adminContext } from "@/lib/admin/server";

export const generateMetadata = () => adminMetadata("prices");

async function Prices() {
  const { api } = await adminContext();
  const rows = await api.metalPrices();
  return (
    <AdminIntl>
      <MetalPrices rows={rows} />
    </AdminIntl>
  );
}

export default function Page() {
  return (
    <AdminPage page="prices">
      <Prices />
    </AdminPage>
  );
}
