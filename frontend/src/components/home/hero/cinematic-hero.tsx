import { ArrowRight, ChevronDown } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { HERO_SCENES } from "./hero-media";
import { HeroMotion } from "./hero-motion";
import { HandwrittenWordmark } from "@/components/brand/handwritten-wordmark";

const delay = (d: number) => ({ "--d": d }) as CSSProperties;

/** Where a scene name leads: the catalog filtered to that metal, or to pieces with a diamond. */
const SCENE_HREF = {
  diamond: "/products?minCarat=0.01",
  gold: "/products?metal=GOLD",
  silver: "/products?metal=SILVER",
} as const;

/**
 * Home hero (#27): a white tiger, a golden tiger and a black panther walk in (an
 * AI clip, cut out frame by frame) and stop in the center under a shadow-like
 * "Jeparla" that is part of the footage; on scroll a gold light sweep turns each
 * of them into a model wearing diamond, gold or silver jewelry, and the brand line
 * appears above the headline. Then the camera visits each model in turn (scene 1, 2,
 * 3, named by the rail at the bottom) and pulls back to the group. One slogan and two calls to action are real HTML in
 * three languages. Media and scroll logic: <HeroMotion>; layout: globals.css
 * under .hero.
 */
export function CinematicHero() {
  const t = useTranslations("Hero");

  return (
    <HeroMotion label={t("label")} scene={t("scene")}>
      <div className="hero-copy">
        <p aria-hidden data-hero-brand className="hero-brand">
          <HandwrittenWordmark />
          <span className="sr-only">Jeparla</span>
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

      {/* Scene rail: names the three models left to right; on scroll the camera visits
          each in turn and its line fills. Without motion it stays as a quiet legend. */}
      <ol data-hero-scenes aria-label={t("scenesLabel")} className="hero-scenes">
        {HERO_SCENES.map((key, i) => (
          <li key={key}>
            {/* The name opens the catalog with the pieces of that kind, from every store. */}
            <Link href={SCENE_HREF[key]} prefetch={false} className="touch-target">
              <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              {t(`scenes.${key}`)}
            </Link>
            <span aria-hidden className="hero-scene-bar">
              <span data-scene-bar />
            </span>
          </li>
        ))}
      </ol>
    </HeroMotion>
  );
}
