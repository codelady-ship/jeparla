import { Suspense } from "react";
import { merchantMetadata } from "@/components/merchant/merchant-shell";
import { ProductFormPage, ProductFormSkeleton } from "@/components/merchant/product-form-page";

export const generateMetadata = () => merchantMetadata("newProduct");

export default function NewProductPage() {
  return (
    <Suspense fallback={<ProductFormSkeleton />}>
      <ProductFormPage />
    </Suspense>
  );
}
