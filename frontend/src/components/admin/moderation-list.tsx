"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { StatusBadge } from "@/components/merchant/status-badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PRODUCT_ACTIONS } from "@/lib/admin/decisions";
import { filterList, PRODUCT_FILTERS, shortDate } from "@/lib/admin/filter";
import { formatPrice } from "@/lib/money";
import { notices } from "@/lib/notice";
import type { ProductStatus } from "@/types/api";
import type { ModerationItem } from "@/types/admin";
import { DecisionButtons } from "./decision-buttons";
import { EmptyFiltered, ListToolbar, useListFilter } from "./list-toolbar";
import { Note } from "./stores-list";

type Filter = (typeof PRODUCT_FILTERS)[number];

/** Product moderation: approve or return what sellers submit, take down live products. */
export function ModerationList({
  rows: initial,
  initialQuery,
  initialStatus,
}: {
  rows: ModerationItem[];
  initialQuery: string;
  initialStatus: Filter;
}) {
  const t = useTranslations("Admin");
  const ts = useTranslations("Merchant.status");
  const locale = useLocale() as Locale;
  const [rows, setRows] = useState(initial);
  const filter = useListFilter<Filter>(initialQuery, initialStatus, "IN_REVIEW");
  const shown = filterList(
    rows,
    filter.q,
    filter.status,
    (r) => `${r.name.az} ${r.name.en} ${r.name.ru} ${r.store.name}`,
  );

  function actions(row: ModerationItem) {
    const name = row.name[locale];
    return (
      <div className="flex flex-wrap gap-2">
        {row.status === "APPROVED" && (
          <Link
            href={`/products/${row.slug}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ExternalLink aria-hidden className="size-4" />
            {t("products.preview")}
            <span className="sr-only">: {name}</span>
          </Link>
        )}
        <DecisionButtons<ProductStatus>
          endpoint={`/api/admin/products/${row.id}`}
          name={name}
          actions={PRODUCT_ACTIONS[row.status]}
          onDone={({ status, note }) => {
            setRows((all) => all.map((r) => (r.id === row.id ? { ...r, status, note } : r)));
            notices.show(t("done", { name, status: ts(status) }));
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        filter={filter}
        options={PRODUCT_FILTERS.map((s) => ({ value: s, label: ts(s) }))}
        labels={{ search: t("products.search"), status: t("statusLabel") }}
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("products.count", { count: shown.length })}
      </p>

      {shown.length === 0 ? (
        <EmptyFiltered
          text={
            filter.status === "IN_REVIEW" && !filter.q
              ? t("products.queueEmpty")
              : t("emptyFiltered")
          }
          clearLabel={t("clearFilters")}
          onClear={filter.clear}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-lg border bg-card p-3 md:flex-row md:items-center md:gap-4"
            >
              <div className="flex min-w-0 flex-1 gap-3">
                {row.imageUrl ? (
                  <Image
                    src={row.imageUrl}
                    alt=""
                    width={64}
                    height={80}
                    className="h-20 w-16 shrink-0 rounded-md bg-muted object-cover"
                  />
                ) : (
                  <span aria-hidden className="h-20 w-16 shrink-0 rounded-md bg-muted" />
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="line-clamp-2 font-medium">{row.name[locale]}</p>
                  <p className="text-sm text-muted-foreground">
                    {[row.store.name, row.fineness].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-sm tabular-nums">
                    {row.priceFrom && formatPrice(row.priceFrom.amount, locale)}
                    {row.submittedAt && (
                      <span className="text-muted-foreground">
                        {row.priceFrom && " · "}
                        {t("submitted", { date: shortDate(row.submittedAt) })}
                      </span>
                    )}
                  </p>
                  <StatusBadge status={row.status} label={ts(row.status)} />
                  {row.note && <Note label={t("note")} text={row.note} />}
                </div>
              </div>
              {actions(row)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
