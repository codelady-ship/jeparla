import { FlaskConical } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { USING_MOCK } from "@/lib/api";

/**
 * Honesty rule (CLAUDE.md): while the site runs on the built-in sample data
 * (NEXT_PUBLIC_USE_MOCK=true, demos and CI only) every page says so at the top.
 * Renders nothing with the real backend.
 */
export async function SampleDataBanner({ locale }: { locale: Locale }) {
  if (!USING_MOCK) return null;
  const t = await getTranslations({ locale, namespace: "SampleData" });
  return (
    <p
      role="note"
      className="flex items-center justify-center gap-2 border-b bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground"
    >
      <FlaskConical aria-hidden className="size-3.5 shrink-0" />
      <strong className="font-semibold text-foreground">{t("label")}:</strong>
      <span>{t("banner")}</span>
    </p>
  );
}
