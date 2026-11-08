import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminIntl, adminMetadata } from "@/components/admin/admin-shell";
import { ModerationList } from "@/components/admin/moderation-list";
import { Skeleton } from "@/components/ui/skeleton";
import { PRODUCT_FILTERS, pickStatus } from "@/lib/admin/filter";
import { adminContext } from "@/lib/admin/server";

export const generateMetadata = () => adminMetadata("products");

type SP = PageProps<"/[locale]/admin/products">["searchParams"];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function List({ searchParams }: { searchParams: SP }) {
  const [{ api }, sp] = await Promise.all([adminContext(), searchParams]);
  const rows = await api.products();
  return (
    <AdminIntl>
      <ModerationList
        rows={rows}
        initialQuery={first(sp.q)}
        initialStatus={pickStatus(first(sp.status), PRODUCT_FILTERS, "IN_REVIEW")}
      />
    </AdminIntl>
  );
}

export default async function Page({ searchParams }: PageProps<"/[locale]/admin/products">) {
  const t = await getTranslations("Admin.products");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <Suspense
        fallback={
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-11 w-full" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        }
      >
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
