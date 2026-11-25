import { Sparkles } from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { aiStudioHref } from "@/lib/merchant/on-model";

/**
 * "Awaiting approval" (#316): the product has an AI Studio result the seller has not approved
 * or rejected yet. Links to the product's AI Studio; nothing when no result waits.
 */
export function AiReviewBadge({
  productId,
  count,
  label,
  name,
}: {
  productId: number;
  count: number | undefined;
  label: string;
  /** Accessible name of the link, with the product name. */
  name: string;
}) {
  if (!count) return null;
  return (
    <Link
      href={aiStudioHref(productId)}
      aria-label={name}
      className={badgeVariants({ variant: "gold" })}
    >
      <Sparkles aria-hidden />
      {label}
    </Link>
  );
}
