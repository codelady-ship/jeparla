"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { onModelPrompt } from "@/lib/merchant/on-model";

/**
 * "Show on a model" (#316): after a photo is added and on the saved screen, the seller learns
 * that an on-model image is on its way, or where to make one (AI Studio).
 */
export function OnModelPrompt({
  place,
  autoTryOn,
  creating,
  productId,
}: {
  place: "photos" | "done";
  autoTryOn: boolean;
  creating: boolean;
  productId: number | null;
}) {
  const t = useTranslations("Merchant.form.onModel");
  const { text, href } = onModelPrompt({ place, autoTryOn, creating, productId });
  return (
    <section
      aria-labelledby={`on-model-${place}`}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-left sm:flex-row sm:items-center sm:gap-4"
    >
      <Sparkles aria-hidden className="size-5 shrink-0 text-gold-text" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 id={`on-model-${place}`} className="font-medium">
          {t("title")}
        </h3>
        <p className="text-sm text-muted-foreground">{t(text)}</p>
      </div>
      {href && (
        <Link href={href} className={buttonVariants({ variant: "outline", size: "lg" })}>
          <Sparkles aria-hidden />
          {t("open")}
        </Link>
      )}
    </section>
  );
}
