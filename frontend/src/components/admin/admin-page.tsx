import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminPage as AdminPageKey } from "./admin-shell";

/** First value of a search param. */
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Heading, intro and a streamed body with a skeleton while the data loads.
 * Shared by the part-2 pages (catalog, users, reports, audit, prices).
 */
export async function AdminPage({ page, children }: { page: AdminPageKey; children: ReactNode }) {
  const t = await getTranslations(`Admin.${page}`);
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
        {children}
      </Suspense>
    </div>
  );
}
