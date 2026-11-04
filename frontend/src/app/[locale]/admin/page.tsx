import { AreaPlaceholder, areaMetadata } from "@/components/auth/area-placeholder";

export const generateMetadata = () => areaMetadata("admin");

export default function AdminPage() {
  return <AreaPlaceholder area="admin" />;
}
