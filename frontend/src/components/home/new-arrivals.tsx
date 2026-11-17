import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProductGrid } from "@/components/product/product-grid";
import { Reveal } from "@/components/motion/reveal";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { GHOST_PILL } from "./pills";

/**
 * New arrivals as a 50/50 split: four pieces on one side, a full-height close-up of
 * jewellery worn on the hand on the other (stock still, decorative; see the note).
 */
export async function NewArrivals() {
  const [t, page] = await Promise.all([
    getTranslations("Home"),
    api.listProducts({ sort: "newest", size: 4 }),
  ]);
  if (page.content.length === 0) return null;
  const src = (w: number) => `/media/editorial/hands-${w}.avif`;
  return (
    <section
      aria-labelledby="new-arrivals"
      className="home-wrap home-pad grid gap-10 lg:grid-cols-2 lg:gap-16"
    >
      <Reveal className="flex flex-col justify-center">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 id="new-arrivals" className="home-head text-3xl sm:text-5xl">
            {t("newArrivals")}
          </h2>
          <Link href="/products?sort=newest" className={GHOST_PILL}>
            {t("seeAll")}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        <ProductGrid
          products={page.content}
          className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6"
        />
      </Reveal>
      <Reveal as="figure" index={1} className="flex flex-col">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted lg:aspect-auto lg:min-h-[40rem] lg:flex-1">
          {/* Pre-encoded AVIF in two widths; next/image would re-encode it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src(900)}
            srcSet={`${src(540)} 540w, ${src(900)} 900w`}
            sizes="(min-width: 64rem) 45vw, 92vw"
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <figcaption className="mt-2 text-xs text-muted-foreground">{t("decorNote")}</figcaption>
      </Reveal>
    </section>
  );
}
