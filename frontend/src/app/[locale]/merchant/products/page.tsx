import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MerchantIntl, merchantMetadata } from "@/components/merchant/merchant-shell";
import { ProductTable } from "@/components/merchant/product-table";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { STATUS_FILTERS, type StatusFilter } from "@/lib/merchant/filter";
import { merchantContext } from "@/lib/merchant/server";

export const generateMetadata = () => merchantMetadata("products");

type SP = PageProps<"/[locale]/merchant/products">["searchParams"];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Products({ searchParams }: { searchParams: SP }) {
  const [{ api }, sp, t] = await Promise.all([
    merchantContext(),
    searchParams,
    getTranslations("Merchant.dashboard"),
  ]);
  const rows = await api.products();
  const status = first(sp.status);
  const initialStatus: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(status)
    ? (status as StatusFilter)
    : "ALL";

  if (rows.length === 0)
    return (
      <section className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-14 text-center">
        <h2 className="text-2xl">{t("emptyTitle")}</h2>
        <p className="max-w-md text-muted-foreground">{t("emptyText")}</p>
      </section>
    );

  return (
    <MerchantIntl>
      <ProductTable rows={rows} initialQuery={first(sp.q)} initialStatus={initialStatus} />
    </MerchantIntl>
  );
}

export default async function MerchantProductsPage({
  searchParams,
}: PageProps<"/[locale]/merchant/products">) {
  const t = await getTranslations("Merchant");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl">{t("products.title")}</h1>
        <Link href="/merchant/products/new" className={buttonVariants({ size: "lg" })}>
          <Plus aria-hidden />
          {t("dashboard.newProduct")}
        </Link>
      </div>
      <Suspense
        fallback={
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-11 w-full" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        }
      >
        <Products searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
