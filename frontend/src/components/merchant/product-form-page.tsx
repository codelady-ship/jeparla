import { FileImage } from "lucide-react";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { routing } from "@/i18n/routing";
import { api as publicApi, USING_MOCK } from "@/lib/api";
import { merchantDrafts } from "@/lib/api/drafts";
import { suggestAudience } from "@/lib/merchant/audience";
import { draftFilledFields, draftInput, type DraftOptions } from "@/lib/merchant/from-draft";
import { metalSiblings } from "@/lib/merchant/metal-sibling";
import { merchantContext } from "@/lib/merchant/server";
import { MerchantIntl, SellerBanner } from "./merchant-shell";
import { MetalSiblingPicker } from "./metal-sibling-picker";
import { ProductForm } from "./product-form";

/** Server part of /merchant/products/new and /[id]/edit: options, seller status, product. */
export async function ProductFormPage({
  id,
  draft,
}: {
  id?: string;
  /** `?draft=<id>` of /merchant/products/new (#109). */
  draft?: Promise<string | undefined>;
}) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const { api } = await merchantContext();
  const productId = id === undefined ? null : Number(id);
  const [store, product, categories, finenesses, t, prices, occasions, siblings, tm] =
    await Promise.all([
      api.store(),
      productId === null ? null : Number.isInteger(productId) ? api.product(productId) : null,
      publicApi.listCategories(),
      publicApi.listFinenesses(),
      getTranslations("Merchant.form"),
      // Without a quote the form still works; the preview says the rate is missing.
      publicApi.latestMetalPrices().catch(() => []),
      // Occasion tags are optional (#115): without the list the form simply leaves them out.
      publicApi.listCollections().catch(() => []),
      // Same design in another metal (V70): edit page only; without it the section is left out.
      productId !== null && Number.isInteger(productId) ? metalSiblings(productId) : null,
      getTranslations("Product.metal"),
    ]);
  const quotes = Object.fromEntries(
    prices.map((q) => [q.metal, { pricePerGram: q.pricePerGram, date: q.date }]),
  );
  if (productId !== null && !product) notFound();

  // "Create product" from a photo or catalog PDF draft (#109): its photo and suggestions.
  const draftId = productId === null && draft ? Number(await draft) : NaN;
  const fromDraft = Number.isInteger(draftId)
    ? ((await merchantDrafts().catch(() => [])).find((d) => d.id === draftId) ?? null)
    : null;

  // Leaf categories only: a product sits in the most specific one.
  const parents = new Set(categories.map((c) => c.parentId).filter((v) => v !== null));
  const options = categories
    .filter((c) => !parents.has(c.id))
    .map((c) => ({
      value: c.slug,
      label: c.name[locale],
      audience: suggestAudience(c.id, categories),
    }));
  const fineOptions = finenesses.map((f) => ({
    value: String(f.id),
    label: f.label,
    metal: f.metal,
    fineness: f.value,
  }));

  // The PDF page text (catalog auto-fill) is read against what the form offers.
  const draftOptions: DraftOptions = { categories: options, finenesses: fineOptions };
  const fromDraftInput = fromDraft ? draftInput(fromDraft, draftOptions) : undefined;
  if (fromDraftInput?.category) {
    const audience = options.find((o) => o.value === fromDraftInput.category)?.audience;
    if (audience) fromDraftInput.audience = audience;
  }
  const initial = product?.input ?? fromDraftInput;
  const filled = fromDraft ? draftFilledFields(fromDraft, draftOptions) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">{product ? t("editTitle") : t("newTitle")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <SellerBanner status={store.sellerStatus} />
      {fromDraft && (
        <p className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm">
          <FileImage aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-text" />
          {filled.length > 0
            ? t("fromDraftSuggested", {
                fields: filled.map((f) => t(`autofillFields.${f}`)).join(", "),
              })
            : t("fromDraft")}
        </p>
      )}
      <MerchantIntl>
        <ProductForm
          draftKey={product ? String(product.id) : fromDraft ? `draft-${fromDraft.id}` : "new"}
          initial={initial}
          productStatus={product?.status}
          productId={product?.id}
          video={product?.video}
          categories={options}
          finenesses={fineOptions}
          quotes={quotes}
          sellerApproved={store.sellerStatus === "VERIFIED"}
          requireDocs={USING_MOCK}
          sellerKind={store.sellerKind ?? "PRECIOUS"}
          occasions={occasions.map((o) => ({ value: String(o.id), label: o.name[locale] }))}
        />
        {product && siblings && (
          <MetalSiblingPicker
            productId={product.id}
            initial={siblings}
            metalNames={{
              GOLD: tm("GOLD"),
              SILVER: tm("SILVER"),
              PLATINUM: tm("PLATINUM"),
              PALLADIUM: tm("PALLADIUM"),
            }}
          />
        )}
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
