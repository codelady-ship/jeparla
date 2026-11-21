"use client";

import { ArrowRight, PackagePlus, Share2, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const STEPS = [
  { key: "profile", href: "/merchant/profile", Icon: Store },
  { key: "product", href: "/merchant/products/new", Icon: PackagePlus },
  { key: "share", href: "/merchant/share", Icon: Share2 },
] as const;

/** The guide itself; loaded by <SellerGuide> only while it has not been dismissed. */
export default function SellerGuideCard({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations("Merchant.guide");
  return (
    <section
      aria-labelledby="seller-guide"
      className="flex flex-col gap-4 rounded-lg border border-gold/50 bg-card p-4 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="seller-guide" className="text-2xl">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {STEPS.map(({ key, href, Icon }, i) => (
          <li key={key} className="relative flex gap-3 rounded-lg border bg-background p-4">
            <span
              aria-hidden
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-gold-text"
            >
              <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-xs text-muted-foreground">
                {t("stepOf", { step: i + 1, total: STEPS.length })}
              </p>
              <h3 className="font-sans text-base font-semibold">{t(`${key}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`${key}.text`)}</p>
              {/* The stretched link makes the whole step one target, far larger than 44px. */}
              <Link
                href={href}
                className="mt-1 inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium underline underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
              >
                {t(`${key}.action`)}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" onClick={onDismiss} className="h-11 self-start px-5">
        {t("dismiss")}
      </Button>
    </section>
  );
}
