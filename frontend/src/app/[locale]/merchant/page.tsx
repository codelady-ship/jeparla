import { AreaPlaceholder, areaMetadata } from "@/components/auth/area-placeholder";

export const generateMetadata = () => areaMetadata("merchant");

export default function MerchantPage() {
  return <AreaPlaceholder area="merchant" />;
}
