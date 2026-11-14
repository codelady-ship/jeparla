import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { merchantMetadata } from "@/components/merchant/merchant-shell";
import { ReadAllButton } from "@/components/merchant/read-all-button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { USING_MOCK } from "@/lib/api";
import { notifications } from "@/lib/api/account";
import { merchantContext } from "@/lib/merchant/server";

export const generateMetadata = () => merchantMetadata("notifications");

const when = (iso: string) => {
  const [date, time] = iso.split("T");
  return `${date.split("-").reverse().join(".")} ${time?.slice(0, 5) ?? ""}`.trim();
};

/** Each text was written in the seller's language when the decision was made (#138). */
async function List() {
  await merchantContext();
  const [t, page] = await Promise.all([getTranslations("Merchant.notifications"), notifications()]);
  if (page.content.length === 0)
    return (
      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  return (
    <div className="flex flex-col gap-4">
      {page.content.some((n) => !n.readAt) && <ReadAllButton label={t("readAll")} />}
      <ul className="flex flex-col gap-3">
        {page.content.map((n) => (
          <li key={n.id} className="flex gap-3 rounded-lg border bg-card p-4">
            <Bell aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{n.title}</p>
                {!n.readAt && <Badge variant="gold">{t("unread")}</Badge>}
              </div>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{n.body}</p>
              <time dateTime={n.createdAt} className="text-xs text-muted-foreground tabular-nums">
                {when(n.createdAt)}
              </time>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function MerchantNotificationsPage() {
  const [t, tm] = await Promise.all([
    getTranslations("Merchant.notifications"),
    getTranslations("Merchant"),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      {USING_MOCK ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {tm("sampleOnly")}
        </p>
      ) : (
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
          <List />
        </Suspense>
      )}
    </div>
  );
}
