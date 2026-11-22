"use client";

import { CircleCheck, CircleDashed, CircleMinus, ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { sellerDraft, type SellerDraft } from "@/lib/seller/draft";
import { cn } from "cn";

type Status = "pending" | "waiting" | "none" | "draft";
const ICON = {
  pending: CircleDashed,
  waiting: CircleMinus,
  none: CircleMinus,
  draft: CircleDashed,
};

/** Last screen: congratulations, what happens next, and the honest check status. */
export function SellerDone({ draft }: { draft: SellerDraft }) {
  const t = useTranslations("Sell.done");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Bijouterie stores need no documents (#128): no documents row and no reminder.
  const fashion = draft.store.sellerKind === "FASHION";
  const rows: { label: string; status: Status }[] = [
    { label: t("rows.seller"), status: "pending" },
    ...(fashion
      ? []
      : [
          {
            label: t("rows.documents"),
            status: (draft.docs.length ? "pending" : "waiting") as Status,
          },
        ]),
    { label: t("rows.product"), status: draft.productSkipped ? "none" : "draft" },
  ];

  // The first product is a draft without photos: one tap to its form (#301). Without an id
  // (sample data, or the product was not saved) the product list is the way there.
  const draftHref =
    !fashion && !draft.productSkipped
      ? draft.productId
        ? `/merchant/products/${draft.productId}/edit`
        : "/merchant/products"
      : null;

  return (
    <section className="flex flex-col gap-6 rounded-lg border bg-card p-6 sm:p-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <CircleCheck aria-hidden className="size-14 text-success" strokeWidth={1.5} />
        <h2 ref={headingRef} tabIndex={-1} className="text-3xl outline-none">
          {t("title")}
        </h2>
        <p className="max-w-lg text-muted-foreground">
          {t("text", { store: draft.store.storeName })}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg">{t("statusTitle")}</h3>
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => {
            const Icon = ICON[r.status];
            return (
              <li key={r.label} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>{r.label}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    r.status === "pending" || r.status === "draft"
                      ? "text-gold-text"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {t(`status.${r.status}`)}
                </span>
              </li>
            );
          })}
        </ul>
        {draftHref && (
          <Link
            href={draftHref}
            className="touch-target inline-flex items-center gap-2 self-start link-underline text-sm text-gold-text"
          >
            <ImagePlus aria-hidden className="size-4" />
            {t("addPhoto")}
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg">{t("nextTitle")}</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{t("next.review")}</li>
          {!fashion && !draft.docs.length && <li>{t("next.docs")}</li>}
          <li>{t("next.products")}</li>
          <li>{t("next.publish")}</li>
        </ol>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/merchant" className={cn(buttonVariants({ size: "lg" }), "h-11")}>
          {t("dashboard")}
        </Link>
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}>
          {t("home")}
        </Link>
      </div>
      <button
        type="button"
        onClick={() => sellerDraft.clear()}
        className="self-center text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        {t("startOver")}
      </button>
    </section>
  );
}
