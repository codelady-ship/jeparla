import { Badge } from "@/components/ui/badge";
import type { ProductStatus } from "@/types/api";

const VARIANT: Record<ProductStatus, "default" | "gold" | "secondary" | "destructive" | "outline"> =
  {
    APPROVED: "default",
    IN_REVIEW: "gold",
    DRAFT: "secondary",
    RETURNED: "destructive",
    INACTIVE: "outline",
  };

export function StatusBadge({ status, label }: { status: ProductStatus; label: string }) {
  return <Badge variant={VARIANT[status]}>{label}</Badge>;
}
