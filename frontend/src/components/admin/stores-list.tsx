"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { mapHref } from "@/lib/geo/map-link";
import { STORE_ACTIONS } from "@/lib/admin/decisions";
import { filterList, shortDate, STORE_FILTERS } from "@/lib/admin/filter";
import { notices } from "@/lib/notice";
import type { AdminStore, StoreStatus } from "@/types/admin";
import { DecisionButtons } from "./decision-buttons";
import { LegalHoldButton } from "./legal-hold-button";
import { EmptyFiltered, ListToolbar, useListFilter } from "./list-toolbar";

type Filter = (typeof STORE_FILTERS)[number];

const VARIANT: Record<StoreStatus, "default" | "gold" | "destructive" | "outline"> = {
  PENDING: "gold",
  APPROVED: "default",
  REJECTED: "outline",
  BLOCKED: "destructive",
};

/** Store applications: approve or reject new sellers, block and unblock live stores. */
export function StoresList({
  rows: initial,
  initialQuery,
  initialStatus,
}: {
  rows: AdminStore[];
  initialQuery: string;
  initialStatus: Filter;
}) {
  const t = useTranslations("Admin");
  const [rows, setRows] = useState(initial);
  const filter = useListFilter<Filter>(initialQuery, initialStatus, "ALL");
  const shown = filterList(
    rows,
    filter.q,
    filter.status,
    (r) => `${r.name} ${r.city} ${r.owner} ${r.slug}`,
  );

  const badge = (s: StoreStatus) => <Badge variant={VARIANT[s]}>{t(`storeStatus.${s}`)}</Badge>;

  function actions(row: AdminStore) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <DecisionButtons<StoreStatus>
          endpoint={`/api/admin/stores/${row.id}`}
          name={row.name}
          actions={STORE_ACTIONS[row.status]}
          onDone={({ status, note }) => {
            setRows((all) => all.map((r) => (r.id === row.id ? { ...r, status, note } : r)));
            notices.show(t("done", { name: row.name, status: t(`storeStatus.${status}`) }));
          }}
        />
        <LegalHoldButton
          storeId={row.id}
          name={row.name}
          heldAt={row.legalHoldAt ?? null}
          onChange={(legalHoldAt) =>
            setRows((all) => all.map((r) => (r.id === row.id ? { ...r, legalHoldAt } : r)))
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        filter={filter}
        options={STORE_FILTERS.map((s) => ({ value: s, label: t(`storeStatus.${s}`) }))}
        labels={{ search: t("stores.search"), status: t("statusLabel") }}
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("stores.count", { count: shown.length })}
      </p>

      {shown.length === 0 ? (
        <EmptyFiltered
          text={t("emptyFiltered")}
          clearLabel={t("clearFilters")}
          onClear={filter.clear}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:hidden">
            {shown.map((row) => (
              <li key={row.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-medium break-words">{row.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.city}
                      {" · "}
                      {row.owner}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t("submitted", { date: shortDate(row.submittedAt) })}
                    </p>
                    <MapCheck row={row} />
                  </div>
                  {badge(row.status)}
                </div>
                {row.note && <Note label={t("note")} text={row.note} />}
                {actions(row)}
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th scope="col" className="p-3 font-medium">
                    {t("stores.colStore")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("stores.colOwner")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("colSubmitted")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("colStatus")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("colActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id} className="border-t align-middle">
                    <th scope="row" className="p-3 text-left font-normal">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{row.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.productCount === null
                            ? row.city
                            : `${row.city} · ${t("stores.products", { count: row.productCount })}`}
                        </span>
                        <MapCheck row={row} />
                        {row.note && <Note label={t("note")} text={row.note} />}
                      </div>
                    </th>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span>{row.owner}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {row.phone}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap tabular-nums">
                      {shortDate(row.submittedAt)}
                    </td>
                    <td className="p-3">{badge(row.status)}</td>
                    <td className="p-3">{actions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** The seller's address and map point (#116): the admin opens the point and compares it with the address. */
function MapCheck({ row }: { row: AdminStore }) {
  const t = useTranslations("Admin.stores");
  const href = mapHref(row.geo);
  return (
    <span className="flex flex-col text-xs">
      {row.address && <span className="text-muted-foreground">{row.address}</span>}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("mapCheck", { store: row.name })}
          className="flex items-center gap-1 self-start link-underline font-medium"
        >
          <MapPin aria-hidden className="size-3.5" />
          {t("mapCheckShort")}
          <span className="text-muted-foreground tabular-nums">
            ({row.geo?.lat}, {row.geo?.lng})
          </span>
        </a>
      ) : (
        <span className="text-muted-foreground">{t("noMap")}</span>
      )}
    </span>
  );
}

export function Note({ label, text }: { label: string; text: string }) {
  return (
    <p className="rounded-md bg-muted p-2 text-xs">
      <span className="font-semibold">{label}: </span>
      {text}
    </p>
  );
}
