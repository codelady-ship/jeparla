"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { REPORT_ACTIONS } from "@/lib/admin/decisions";
import { filterList, REPORT_FILTERS, shortDate } from "@/lib/admin/filter";
import { notices } from "@/lib/notice";
import type { ProductReport, ReportStatus } from "@/types/admin";
import { DecisionButtons } from "./decision-buttons";
import { EmptyFiltered, ListToolbar, useListFilter } from "./list-toolbar";
import { Note } from "./stores-list";

type Filter = (typeof REPORT_FILTERS)[number];

const VARIANT: Record<ReportStatus, "gold" | "default" | "outline"> = {
  OPEN: "gold",
  RESOLVED: "default",
  DISMISSED: "outline",
};

/**
 * Buyer complaints about products. Resolving means the store fixed it (or the
 * product was taken down under moderation); dismissing needs a reason.
 */
export function ReportsList({
  rows: initial,
  initialQuery,
  initialStatus,
}: {
  rows: ProductReport[];
  initialQuery: string;
  initialStatus: Filter;
}) {
  const t = useTranslations("Admin");
  const locale = useLocale() as Locale;
  const [rows, setRows] = useState(initial);
  const filter = useListFilter<Filter>(initialQuery, initialStatus, "OPEN");
  const shown = filterList(
    rows,
    filter.q,
    filter.status,
    (r) =>
      `${r.product.name.az} ${r.product.name.en} ${r.product.name.ru} ${r.store.name} ${r.message}`,
  );

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        filter={filter}
        options={REPORT_FILTERS.map((s) => ({ value: s, label: t(`reportStatus.${s}`) }))}
        labels={{ search: t("reports.search"), status: t("statusLabel") }}
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("reports.count", { count: shown.length })}
      </p>

      {shown.length === 0 ? (
        filter.status === "OPEN" && !filter.q ? (
          <p className="rounded-lg border border-dashed px-4 py-12 text-center">
            {t("reports.queueEmpty")}
          </p>
        ) : (
          <EmptyFiltered
            text={t("emptyFiltered")}
            clearLabel={t("clearFilters")}
            onClear={filter.clear}
          />
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((row) => {
            const name = row.product.name[locale];
            return (
              <li key={row.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{t(`reportReason.${row.reason}`)}</Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t("submitted", { date: shortDate(row.createdAt) })}
                      </span>
                    </p>
                    <Link
                      href={`/products/${row.product.slug}`}
                      className="font-medium break-words underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{row.store.name}</p>
                  </div>
                  <Badge variant={VARIANT[row.status]}>{t(`reportStatus.${row.status}`)}</Badge>
                </div>
                <blockquote lang="az" className="border-l-2 border-gold pl-3 text-sm">
                  {row.message}
                </blockquote>
                {row.note && <Note label={t("note")} text={row.note} />}
                <DecisionButtons<ReportStatus>
                  endpoint={`/api/admin/reports/${row.id}`}
                  name={name}
                  actions={REPORT_ACTIONS[row.status]}
                  reasonLabel={t("reason.reporter")}
                  onDone={({ status, note }) => {
                    setRows((all) =>
                      all.map((r) => (r.id === row.id ? { ...r, status, note } : r)),
                    );
                    notices.show(t("done", { name, status: t(`reportStatus.${status}`) }));
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
