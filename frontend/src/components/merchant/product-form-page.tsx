import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { routing } from "@/i18n/routing";
import { api as publicApi } from "@/lib/api";
import { suggestAudience } from "@/lib/merchant/audience";
import { merchantContext } from "@/lib/merchant/server";
import { MerchantIntl, SellerBanner } from "./merchant-shell";
import { ProductForm } from "./product-form";

/** Server part of /merchant/products/new and /[id]/edit: options, seller status, product. */
export async function ProductFormPage({ id }: { id?: string }) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const { api } = await merchantContext();
  const productId = id === undefined ? null : Number(id);
  const [store, product, categories, finenesses, t, prices] = await Promise.all([
    api.store(),
    productId === null ? null : Number.isInteger(productId) ? api.product(productId) : null,
    publicApi.listCategories(),
    publicApi.listFinenesses(),
    getTranslations("Merchant.form"),
    // Without a quote the form still works; the preview says the rate is missing.
    publicApi.latestMetalPrices().catch(() => []),
  ]);
  const quotes = Object.fromEntries(
    prices.map((q) => [q.metal, { pricePerGram: q.pricePerGram, date: q.date }]),
  );
  if (productId !== null && !product) notFound();

  // Leaf categories only: a product sits in the most specific one.
  const parents = new Set(categories.map((c) => c.parentId).filter((v) => v !== null));
  const options = categories
    .filter((c) => !parents.has(c.id))
    .map((c) => ({
      value: c.slug,
      label: c.name[locale],
      audience: suggestAudience(c.id, categories),
    }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">{product ? t("editTitle") : t("newTitle")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <SellerBanner status={store.sellerStatus} />
      <MerchantIntl>
        <ProductForm
          draftKey={product ? String(product.id) : "new"}
          initial={product?.input}
          productStatus={product?.status}
          categories={options}
          finenesses={finenesses.map((f) => ({
            value: String(f.id),
            label: f.label,
            metal: f.metal,
            fineness: f.value,
          }))}
          quotes={quotes}
          sellerApproved={store.sellerStatus === "VERIFIED"}
        />
      </MerchantIntl>
    </div>
  );
}

export function ProductFormSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
