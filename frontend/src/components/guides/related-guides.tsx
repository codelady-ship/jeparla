import { cn } from "cn";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { GuideSlug } from "@/content/guides/types";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getGuide, guidePath } from "@/lib/guides";

/**
 * Links from a data or product page to the guides that explain it (#63, PLAN 5.18):
 * internal links help readers and tell crawlers which page answers which question.
 */
export async function RelatedGuides({
  locale,
  slugs,
  className,
}: {
  locale: Locale;
  slugs: GuideSlug[];
  className?: string;
}) {
  const t = await getTranslations({ locale, namespace: "Guides" });
  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {slugs.map((slug) => (
        <li key={slug}>
          <Link
            href={guidePath(slug)}
            className="inline-flex min-h-11 items-center gap-1.5 font-medium underline underline-offset-4 hover:text-gold-text"
          >
            {t("relatedGuide", { title: getGuide(locale, slug).title })}
            <ArrowRight aria-hidden className="size-3.5 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
