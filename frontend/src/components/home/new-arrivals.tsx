import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProductGrid } from "@/components/product/product-grid";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";

export async function NewArrivals() {
  const [t, page] = await Promise.all([
    getTranslations("Home"),
    api.listProducts({ sort: "newest", size: 8 }),
  ]);
  if (page.content.length === 0) return null;
  return (
    <section aria-labelledby="new-arrivals" className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 id="new-arrivals" className="text-2xl sm:text-3xl">
          {t("newArrivals")}
        </h2>
        <Link
          href="/products?sort=newest"
          className="inline-flex items-center gap-1 link-underline text-sm font-medium"
        >
          {t("seeAll")}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      <ProductGrid products={page.content} />
    </section>
  );
}
