import { Suspense } from "react";
import { merchantMetadata } from "@/components/merchant/merchant-shell";
import { ProductFormPage, ProductFormSkeleton } from "@/components/merchant/product-form-page";

export const generateMetadata = () => merchantMetadata("newProduct");

/** `?draft=<id>` (#109): the form starts from a photo or catalog PDF draft. */
export default function NewProductPage({
  searchParams,
}: PageProps<"/[locale]/merchant/products/new">) {
  const draft = searchParams.then((sp) => (typeof sp.draft === "string" ? sp.draft : undefined));
  return (
    <Suspense fallback={<ProductFormSkeleton />}>
      <ProductFormPage draft={draft} />
    </Suspense>
  );
}
