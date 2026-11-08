import { ArrowRight, ChevronDown } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { HeroMotion } from "./hero-motion";

const delay = (d: number) => ({ "--d": d }) as CSSProperties;

/**
 * Home hero (#27): three tigers walk in from the left, the back and the right and
 * stop in the center; on scroll a gold light sweep turns each of them into a
 * model wearing silver, gold or diamond jewelry. A large "Jeparla" sits behind
 * them (mix-blend-mode: darken, so the animals pass in front of the type) and
 * fades away as the scroll begins. One slogan and two calls to action are real
 * HTML in three languages. Media and scroll logic: <HeroMotion>; layout: globals.css
 * under .hero.
 */
export function CinematicHero() {
  const t = useTranslations("Hero");

  return (
    <HeroMotion label={t("label")} scene={t("scene")}>
      <div className="hero-copy">
        <h1 className="hero-title font-heading text-balance">{t("title")}</h1>
        <p className="hero-rv mt-4 max-w-sm text-sm text-pretty sm:text-base" style={delay(0)}>
          {t("text")}
        </p>
        <div className="hero-rv mt-6 flex flex-wrap gap-3" style={delay(1)}>
          <Link
            href="/products"
            className={cn(buttonVariants({ variant: "gold", size: "lg" }), "h-11 px-5 text-sm")}
          >
            {t("ctaCollection")}
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Link>
          <Link
            href="/stores"
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
