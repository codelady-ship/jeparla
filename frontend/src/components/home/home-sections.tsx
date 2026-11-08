import { ArrowRight, BadgeCheck, FileCheck2, Microscope, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { MetalPriceWidget } from "@/components/metal/metal-price-widget";
import { CategoryTiles } from "@/components/categories/category-tiles";
import { Reveal } from "@/components/motion/reveal";
import { StoreCard } from "@/components/stores/store-card";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cn } from "cn";

function SectionHead({ id, title, link }: { id: string; title: string; link?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 id={id} className="text-2xl sm:text-3xl">
        {title}
      </h2>
      {link}
    </div>
  );
}

function SeeAll({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 link-underline text-sm font-medium">
      {children}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

const WRAP = "container-page";

export async function HomeCategories() {
  const [t, categories] = await Promise.all([getTranslations("Home"), api.listCategories()]);
  const roots = categories.filter((c) => c.parentId === null).slice(0, 8);
  return (
    <section aria-labelledby="home-categories" className={cn(WRAP, "pb-16")}>
      <SectionHead
        id="home-categories"
        title={t("categories")}
        link={<SeeAll href="/categories">{t("seeAll")}</SeeAll>}
      />
      <CategoryTiles categories={roots} reveal={false} />
    </section>
  );
}

export async function FeaturedStores() {
  const [t, stores] = await Promise.all([getTranslations("Home"), api.listStores()]);
  // Checked stores first; no paid placement exists, so the order says nothing else.
  const rank = (s: (typeof stores)[number]) =>
    Number(s.verification.seller === "VERIFIED") + Number(s.verification.documents === "VERIFIED");
  const featured = [...stores].sort((a, b) => rank(b) - rank(a)).slice(0, 3);
  if (featured.length === 0) return null;
  return (
    <section aria-labelledby="home-stores" className={cn(WRAP, "pb-16")}>
      <SectionHead
        id="home-stores"
        title={t("stores")}
        link={<SeeAll href="/stores">{t("seeAll")}</SeeAll>}
      />
      <ul className="grid gap-4 md:grid-cols-3">
        {featured.map((s, i) => (
          <Reveal key={s.id} as="li" index={i}>
            <StoreCard store={s} />
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

export async function VerifiedExplainer() {
  const t = await getTranslations("Home");
  const items = [
    { key: "seller", Icon: BadgeCheck },
    { key: "documents", Icon: FileCheck2 },
    { key: "expertise", Icon: Microscope },
  ] as const;
  return (
    <section aria-labelledby="home-verified" className="mb-16 border-y bg-card">
      <div className={cn(WRAP, "py-16")}>
        <h2 id="home-verified" className="mb-2 text-2xl sm:text-3xl">
          {t("verifiedTitle")}
        </h2>
        <p className="mb-10 max-w-2xl text-muted-foreground">{t("verifiedText")}</p>
        <ul className="grid gap-8 md:grid-cols-3">
          {items.map(({ key, Icon }, i) => (
            <Reveal key={key} as="li" index={i} className="flex flex-col gap-2">
              <Icon aria-hidden className="size-7 text-gold-text" />
              <h3 className="font-sans text-lg font-semibold">{t(`verified.${key}.title`)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`verified.${key}.text`)}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Daily CBAR gram prices and the 30-day chart (PLAN 5.10). */
export function MetalPrices() {
  return (
    <div className={cn(WRAP, "pb-16")}>
      <MetalPriceWidget />
    </div>
  );
}

export async function BecomeSeller() {
  const t = await getTranslations("Home");
  return (
    <section aria-labelledby="home-seller" className={cn(WRAP, "pb-20")}>
      <Reveal className="flex flex-col items-start gap-4 rounded-lg border p-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <Store aria-hidden className="mt-1 size-8 shrink-0 text-gold-text" />
          <div>
            <h2 id="home-seller" className="text-2xl">
              {t("sellerTitle")}
            </h2>
            <p className="mt-1 max-w-xl text-muted-foreground">{t("sellerText")}</p>
          </div>
        </div>
        <Link
          href="/sell"
          prefetch={false}
          className={cn(buttonVariants({ variant: "gold", size: "lg" }), "h-11")}
        >
          {t("sellerCta")}
        </Link>
      </Reveal>
    </section>
  );
}
