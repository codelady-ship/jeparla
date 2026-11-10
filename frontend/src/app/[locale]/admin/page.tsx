import { ArrowRight, Coins, Flag, PackageCheck, ShieldCheck, Store } from "lucide-react";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { adminContext } from "@/lib/admin/server";
import { shortDate } from "@/lib/admin/filter";
import { formatDecimal } from "@/lib/money";

export const generateMetadata = () => adminMetadata("overview");

async function Overview() {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return null;
  const [{ api }, t] = await Promise.all([adminContext(), getTranslations("Admin.overview")]);
  const o = await api.overview();
  const num = (n: number) => formatDecimal(String(n), locale);

  const queues: { icon: typeof Store; label: string; value: number; href: string }[] = [
    {
      icon: Store,
      label: t("pendingStores"),
      value: o.pendingStores,
      href: "/admin/stores?status=PENDING",
    },
    {
      icon: PackageCheck,
      label: t("productsInReview"),
      value: o.productsInReview,
      href: "/admin/products",
    },
    {
      icon: ShieldCheck,
      label: t("pendingChecks"),
      value: o.pendingChecks,
      href: "/admin/verification",
    },
    ...(o.openReports === null
      ? []
      : [{ icon: Flag, label: t("openReports"), value: o.openReports, href: "/admin/reports" }]),
    {
      icon: Coins,
      label: t("heldPrices"),
      value: o.heldPrices,
      href: "/admin/prices",
    },
  ];
  const waiting = queues.reduce((sum, q) => sum + q.value, 0);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="queues" className="flex flex-col gap-3">
        <h2 id="queues" className="text-2xl">
          {t("queues")}
        </h2>
        {waiting === 0 && <p className="text-muted-foreground">{t("allClear")}</p>}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {queues.map(({ icon: Icon, label, value, href }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full flex-col gap-2 rounded-lg border bg-card p-5 outline-none hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon aria-hidden className="size-4" />
                  {label}
                </span>
                <span className="text-3xl font-semibold tabular-nums">{num(value)}</span>
                <span className="mt-auto flex items-center gap-1 text-sm font-medium">
                  {t("open")}
                  <ArrowRight
                    aria-hidden
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="platform" className="flex flex-col gap-3">
        <h2 id="platform" className="text-2xl">
          {t("platform")}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          {[
            { label: t("stores"), value: num(o.stores) },
            { label: t("liveProducts"), value: num(o.liveProducts) },
            { label: t("metalPrice"), value: o.metalPriceDate ? shortDate(o.metalPriceDate) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1 rounded-lg border p-5">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const t = await getTranslations("Admin.overview");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        }
      >
        <Overview />
      </Suspense>
    </div>
  );
}
