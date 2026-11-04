import { Suspense } from "react";
import { merchantMetadata } from "@/components/merchant/merchant-shell";
import { ProductFormPage, ProductFormSkeleton } from "@/components/merchant/product-form-page";

// Private and per user: one sample id lets the build prerender the static shell
// (header, tabs); the form itself reads the session and always renders on request.
export function generateStaticParams() {
  return [{ id: "0" }];
}

export const generateMetadata = () => merchantMetadata("editProduct");

async function Edit({
  params,
}: {
  params: PageProps<"/[locale]/merchant/products/[id]/edit">["params"];
}) {
  const { id } = await params;
  return <ProductFormPage id={id} />;
}

export default function EditProductPage({
  params,
}: PageProps<"/[locale]/merchant/products/[id]/edit">) {
  return (
    <Suspense fallback={<ProductFormSkeleton />}>
      <Edit params={params} />
    </Suspense>
  );
}
