import { ArrowRight, ChevronDown, Gem } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { HERO_PANELS, itemHref } from "./hero-data";
import { HeroMotion } from "./hero-motion";

const COPY = ["intro", "gold", "shine", "final"] as const;

/**
 * Cinematic home hero (#27). Three big cats (silver, diamond, gold) that turn
 * into models wearing that metal, then the three stand together. All text is
 * real HTML in three languages; the animation is a progressive layer added by
 * <HeroMotion> (scroll-scrubbed timeline, src/lib/motion/scrub.ts). Without JS or with reduced motion the
 * static frame is complete: headline, both CTAs, the three panels and their links.
 * Layout states live in globals.css under [data-hero].
 */
export function CinematicHero() {
  const t = useTranslations("Hero");

  return (
    <HeroMotion label={t("label")}>
      <div data-hero-panels className="hero-panels">
        {HERO_PANELS.map((panel, i) => {
          const name = t(`panels.${panel.key}.name`);
          return (
            <figure key={panel.key} data-hero-panel={panel.key} className="hero-panel">
              <div data-hero-cat className="absolute inset-0">
                <Image
                  src={panel.image}
                  alt={t(`panels.${panel.key}.animal`)}
                  fill
                  priority={i === 0}
                  loading={i === 0 ? undefined : "eager"}
                  placeholder="blur"
                  sizes="(min-width: 768px) 34vw, 100vw"
                  className="object-cover"
                  style={{ objectPosition: panel.position }}
                />
              </div>

              {/* The model this animal turns into; a labelled placeholder until the shoot. */}
              <div data-hero-model className="hero-model" aria-hidden>
                <div data-hero-model-inner className="hero-model-inner">
                  <div className="flex aspect-[3/5] w-3/5 max-w-56 flex-col items-center justify-center gap-3 rounded-t-full border border-scene-gold/50 px-4 text-center md:max-w-44 md:translate-y-[4%]">
                    <Gem className="size-6 text-scene-gold-light" />
                    {/* The caption names the metal on desktop; on phones captions are hidden. */}
                    <span className="font-heading text-2xl text-scene-ivory md:hidden">{name}</span>
                    <span className="text-xs text-scene-ivory-muted">{t("modelSoon")}</span>
                  </div>
                </div>
              </div>

              <span data-hero-sweep aria-hidden className="hero-sweep" />
              <span data-hero-dim aria-hidden className="hero-dim" />

              <figcaption data-hero-caption className="hero-caption">
                <span className="font-heading text-xl text-scene-ivory md:text-2xl">{name}</span>
                <ul className="hero-items flex flex-wrap gap-1.5">
                  {panel.items.map(({ item, category }) => (
                    <li key={item}>
                      <Link
                        href={itemHref(panel, category)}
                        aria-label={t("itemLink", { metal: name, item: t(`items.${item}`) })}
                        className="inline-flex min-h-8 items-center rounded-full border border-scene-ivory/40 bg-scene-deep/50 px-3 text-xs text-scene-ivory backdrop-blur-sm transition-colors hover:border-scene-gold-light hover:text-scene-gold-light focus-visible:ring-3 focus-visible:ring-scene-gold-light/60 focus-visible:outline-none"
                      >
                        {t(`items.${item}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </figcaption>
            </figure>
          );
        })}
      </div>

      <div className="hero-copy">
        <div className="grid">
          {COPY.map((key, i) => {
            const Heading = i === 0 ? "h1" : "p";
            return (
              <div
                key={key}
                data-hero-copy={key}
                className="hero-copy-item col-start-1 row-start-1"
              >
                <Heading className="font-heading text-4xl leading-[1.05] font-medium text-balance text-scene-ivory sm:text-5xl lg:text-6xl">
                  {t(`${key}.title`)}
                </Heading>
                <p className="mt-3 max-w-xl text-sm text-pretty text-scene-ivory-muted sm:text-base">
                  {t(`${key}.text`)}
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
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
              "h-11 border-scene-ivory/50 bg-transparent px-5 text-sm text-scene-ivory hover:bg-scene-ivory/10 hover:text-scene-ivory dark:bg-transparent",
            )}
          >
            {t("ctaStores")}
          </Link>
        </div>
      </div>

      <span data-hero-hint aria-hidden className="hero-hint">
        {t("scrollHint")}
        <ChevronDown className="size-4" />
      </span>

      <p className="hero-credit">
        {HERO_PANELS.map((p) => t("credit", { name: p.credit })).join(" · ")}
      </p>
    </HeroMotion>
  );
}
