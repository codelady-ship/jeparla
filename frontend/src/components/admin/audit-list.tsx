"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { AUDIT_FILTERS, filterList, shortDate } from "@/lib/admin/filter";
import type { AuditEntry } from "@/types/admin";
import { EmptyFiltered, ListToolbar, useListFilter } from "./list-toolbar";

type Filter = (typeof AUDIT_FILTERS)[number];

/** hh:mm of an ISO time as written (Baku time from the backend), no timezone shift. */
const time = (iso: string) => iso.slice(11, 16);

/** Read-only log of admin decisions, newest first. The backend writes it; nobody edits it. */
export function AuditList({
  rows,
  initialQuery,
  initialStatus,
}: {
  rows: AuditEntry[];
  initialQuery: string;
  initialStatus: Filter;
}) {
  const t = useTranslations("Admin");
  const filter = useListFilter<Filter>(initialQuery, initialStatus, "ALL");
  const shown = filterList(
    rows.map((r) => ({ ...r, status: r.target })),
    filter.q,
    filter.status,
    (r) => `${r.targetName} ${r.actor} ${r.reason ?? ""}`,
  );

  const when = (r: AuditEntry) => `${shortDate(r.at)} ${time(r.at)}`;
  // Demo rows carry a message key, API rows an action code such as STORE_APPROVED.
  const action = (r: AuditEntry) => {
    const demo = `auditAction.${r.action}` as "auditAction.approve";
    const code = `auditCode.${r.action}` as "auditCode.STORE_APPROVED";
    return t.has(demo) ? t(demo) : t.has(code) ? t(code) : r.action;
  };

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        filter={filter}
        options={AUDIT_FILTERS.map((s) => ({ value: s, label: t(`auditTarget.${s}`) }))}
        labels={{ search: t("audit.search"), status: t("audit.targetLabel") }}
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("audit.count", { count: shown.length })}
      </p>

      {shown.length === 0 ? (
        <EmptyFiltered
          text={t("emptyFiltered")}
          clearLabel={t("clearFilters")}
          onClear={filter.clear}
        />
      ) : (
        <>
          <ol className="flex flex-col gap-3 md:hidden">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded-lg border p-4">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{t(`auditTarget.${r.target}`)}</Badge>
                  <span className="font-medium">{action(r)}</span>
                </p>
                <p className="break-words">{r.targetName}</p>
                {r.reason && <p className="text-sm text-muted-foreground">{r.reason}</p>}
                <p className="text-xs break-all text-muted-foreground tabular-nums">
                  {when(r)}
                  {" · "}
                  {r.actor}
                </p>
              </li>
            ))}
          </ol>

          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th scope="col" className="p-3 font-medium">
                    {t("audit.colTime")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("audit.colAction")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("audit.colTarget")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("note")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("audit.colActor")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-3 whitespace-nowrap tabular-nums">{when(r)}</td>
                    <th scope="row" className="p-3 text-left font-medium">
                      {action(r)}
                    </th>
                    <td className="p-3">
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant="outline">{t(`auditTarget.${r.target}`)}</Badge>
                        <span>{r.targetName}</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{r.reason ?? "-"}</td>
                    <td className="p-3 text-muted-foreground">{r.actor}</td>
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
