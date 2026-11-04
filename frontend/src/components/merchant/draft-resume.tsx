"use client";

import { FilePen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { productDraft } from "@/lib/merchant/draft";

const noop = () => () => {};

/** "Continue your draft" card when a new product is half done in this browser. */
export function DraftResume() {
  const t = useTranslations("Merchant.dashboard");
  const store = productDraft("new");
  const draft = useSyncExternalStore(store.subscribe, store.get, store.serverSnapshot);
  const exists = useSyncExternalStore(noop, store.exists, () => false);
  if (!exists || !draft.savedAt) return null;
  const name = draft.input.name.trim();
  return (
    <section
      aria-labelledby="draft-resume"
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center"
    >
      <FilePen aria-hidden className="size-5 shrink-0 text-gold-text" />
      <div className="flex flex-1 flex-col gap-1 text-sm">
        <h2 id="draft-resume" className="font-sans text-base font-semibold">
          {t("draftTitle")}
        </h2>
        <p className="text-muted-foreground">
          {name ? t("draftText", { name }) : t("draftUntitled")}
        </p>
      </div>
      <Link href="/merchant/products/new" className={buttonVariants({ variant: "outline" })}>
        {t("draftResume")}
      </Link>
    </section>
  );
}
