import { Construction } from "lucide-react";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

type Area = "merchant" | "admin";

export async function areaMetadata(area: Area): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t(`areas.${area}`), robots: { index: false, follow: false } };
}

/** The proxy only lets the matching role in; the real panels come later (5.7, 5.8). */
export async function AreaPlaceholder({ area }: { area: Area }) {
  const t = await getTranslations("Auth");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <Construction aria-hidden className="size-8 text-gold-text" />
      <h1 className="text-3xl">{t(`areas.${area}`)}</h1>
      <p className="text-muted-foreground">{t("areas.soon")}</p>
    </div>
  );
}
