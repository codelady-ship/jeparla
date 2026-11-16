"use client";

import { FileCheck2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { sendJson } from "@/lib/merchant/client";

/**
 * Asks the seller to accept the code of conduct and the seller terms (#107) when there is no
 * valid acceptance (none, a new version of either, or the year is over) or it runs out within
 * 30 days. Without it products cannot go to review.
 */
export function CodeBanner({
  kind,
  validUntil,
}: {
  kind: "missing" | "due";
  /** Already formatted for the page language; only for "due". */
  validUntil?: string;
}) {
  const t = useTranslations("Merchant.code");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);
    const res = await sendJson("POST", "/api/merchant/profile/code", {});
    setPending(false);
    if (!res.ok) return setError(res.errors.form === "unavailable" ? "unavailable" : "failed");
    router.refresh();
  }

  return (
    <section
      aria-labelledby="code-banner"
      className="flex flex-col gap-3 rounded-lg border border-gold/50 bg-muted p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <FileCheck2 aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-text" />
        <div className="flex flex-col gap-1">
          <h2 id="code-banner" className="font-sans text-sm font-semibold">
            {kind === "due" ? t("dueTitle", { date: validUntil ?? "" }) : t("missingTitle")}
          </h2>
          <p className="text-muted-foreground">{t("text")}</p>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/verified#code" className="link-underline">
              {t("read")}
            </Link>
            <Link href="/legal/sellers" className="link-underline">
              {t("readTerms")}
            </Link>
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Button type="button" onClick={accept} disabled={pending} className="h-11">
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <FileCheck2 aria-hidden />}
          {t("accept")}
        </Button>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {t(error === "unavailable" ? "unavailable" : "failed")}
          </p>
        )}
      </div>
    </section>
  );
}
