import { ArrowRight, ChevronDown } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { HeroMotion } from "./hero-motion";

const delay = (d: number) => ({ "--d": d }) as CSSProperties;

/**
 * Home hero (#27): a white tiger, a golden tiger and a black panther walk in (an
 * AI clip, cut out frame by frame) and stop in the center under a shadow-like
 * "Jeparla" that is part of the footage; on scroll a gold light sweep turns each
 * of them into a model wearing diamond, gold or silver jewelry, and the brand line
 * appears above the headline. One slogan and two calls to action are real HTML in
 * three languages. Media and scroll logic: <HeroMotion>; layout: globals.css
 * under .hero.
 */
export function CinematicHero() {
  const t = useTranslations("Hero");

  return (
    <HeroMotion label={t("label")} scene={t("scene")}>
      <div className="hero-copy">
        <p aria-hidden data-hero-brand className="hero-brand font-heading">
          Jeparla
        </p>
        <h1 className="hero-title font-heading text-balance">{t("title")}</h1>
        <p
          className="hero-rv hero-text mt-4 max-w-sm text-sm text-pretty sm:text-base"
          style={delay(0)}
        >
          {t("text")}
        </p>
        <div className="hero-rv hero-ctas mt-6" style={delay(1)}>
          {/* No viewport prefetch: handling the two RSC prefetches blocked the phone main
              thread during load (#160, about 600 ms throttled); the pages load on click. */}
          <Link
            href="/products"
            prefetch={false}
            className={cn(buttonVariants({ variant: "gold", size: "lg" }), "h-11 px-5 text-sm")}
          >
            {t("ctaCollection")}
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Link>
          <Link
            href="/stores"
            prefetch={false}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 border-scene-green/40 bg-transparent px-5 text-sm text-scene-green hover:bg-scene-green/5 hover:text-scene-green dark:bg-transparent",
            )}
          >
            {t("ctaStores")}
          </Link>
        </div>
      </div>

      <span data-hero-hint aria-hidden className="hero-hint hero-rv" style={delay(2)}>
        {t("scrollHint")}
        <ChevronDown className="size-4" />
      </span>
    </HeroMotion>
  );
}
