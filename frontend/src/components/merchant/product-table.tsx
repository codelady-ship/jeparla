"use client";

import { Pause, Pencil, Play, Search, Send, Sparkles } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { StatusBadge } from "./status-badge";
import type { Locale } from "@/i18n/routing";
import type { BulkStatusResult } from "@/lib/merchant/bulk";
import { sendJson } from "@/lib/merchant/client";
import {
  filterRows,
  STATUS_FILTERS,
  toggledStatus,
  type StatusFilter,
} from "@/lib/merchant/filter";
import { formatDecimal, formatPrice } from "@/lib/money";
import { notices } from "@/lib/notice";
import type { ProductStatus } from "@/types/api";
import type { MerchantProductRow } from "@/types/merchant";

/**
 * Product list with search and status filter. Both live in the URL
 * (?q=&status=) through history.replaceState, so a link from the dashboard
 * opens the filtered list and the server is not asked again on each key.
 */
export function ProductTable({
  rows: initial,
  initialQuery,
  initialStatus,
}: {
  rows: MerchantProductRow[];
  initialQuery: string;
  initialStatus: StatusFilter;
}) {
  const t = useTranslations("Merchant.products");
  const ts = useTranslations("Merchant.status");
  const locale = useLocale() as Locale;
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState(initialQuery);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [busy, setBusy] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const shown = filterRows(rows, q, status);
  /** Drafts in the current view; the API takes 100 per call. */
  const drafts = shown.filter((r) => r.status === "DRAFT").slice(0, 100);

  function sync(nextQ: string, nextStatus: StatusFilter) {
    const sp = new URLSearchParams();
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    if (nextStatus !== "ALL") sp.set("status", nextStatus);
    const s = sp.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }

  async function toggle(row: MerchantProductRow) {
    const next = toggledStatus(row.status);
    if (!next) return;
    const name = row.name[locale];
    setBusy(row.id);
    const result = await sendJson("PATCH", `/api/merchant/products/${row.id}/status`, {
      status: next,
    });
    setBusy(null);
    if (!result.ok) {
      notices.show(t("toggleFailed"));
      return;
    }
    setRows((all) => all.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    notices.show(t(`toggled.${next}`, { name }));
  }

  /** Sends the drafts in view to review (#109); each one succeeds or fails on its own. */
  async function sendDrafts() {
    if (drafts.length === 0) return;
    setBulkBusy(true);
    setBulkErrors([]);
    const result = await sendJson<BulkStatusResult[]>(
      "POST",
      "/api/merchant/products/bulk-status",
      {
        ids: drafts.map((r) => r.id),
        status: "IN_REVIEW",
      },
    );
    setBulkBusy(false);
    if (!result.ok) {
      notices.show(t("bulkFailed"));
      return;
    }
    const done = new Map(
      result.data.filter((r) => r.ok && r.status).map((r) => [r.id, r.status as ProductStatus]),
    );
    setRows((all) => all.map((r) => ({ ...r, status: done.get(r.id) ?? r.status })));
    const names = new Map(rows.map((r) => [r.id, r.name[locale]]));
    setBulkErrors(
      result.data
        .filter((r) => !r.ok)
        .map((r) => `${names.get(r.id) ?? r.id}: ${r.message ?? t("bulkFailed")}`),
    );
    notices.show(t("bulkSent", { done: done.size, total: result.data.length }));
  }

  const price = (row: MerchantProductRow) =>
    row.priceFrom === null ? "—" : t("fromPrice", { price: formatPrice(row.priceFrom, locale) });
  const updated = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}.${m}.${y}`;
  };

  function actions(row: MerchantProductRow) {
    const name = row.name[locale];
    const next = toggledStatus(row.status);
    return (
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/merchant/products/${row.id}/edit`}
          aria-label={t("editNamed", { name })}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <Pencil aria-hidden />
          {t("edit")}
        </Link>
        <Link
          href={`/merchant/products/${row.id}/ai-studio`}
          aria-label={t("aiStudioNamed", { name })}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          <Sparkles aria-hidden />
          {t("aiStudio")}
        </Link>
        {next && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={busy === row.id}
            aria-label={t("toggleNamed", {
              action: next === "INACTIVE" ? t("deactivate") : t("activate"),
              name,
            })}
            onClick={() => void toggle(row)}
          >
            {next === "INACTIVE" ? <Pause aria-hidden /> : <Play aria-hidden />}
            {next === "INACTIVE" ? t("deactivate") : t("activate")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              sync(e.target.value, status);
            }}
            className="h-11 pl-9"
          />
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium sm:w-56">
          {t("statusLabel")}
          <select
            value={status}
            onChange={(e) => {
              const v = e.target.value as StatusFilter;
              setStatus(v);
              sync(q, v);
            }}
            className="h-11 rounded-lg border border-input bg-background px-2.5 text-base font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {ts(s)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("count", { count: shown.length })}
        </p>
        {drafts.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={bulkBusy}
            onClick={() => void sendDrafts()}
          >
            <Send aria-hidden />
            {t("bulkReview", { count: drafts.length })}
          </Button>
        )}
      </div>
      {bulkErrors.length > 0 && (
        <ul
          role="alert"
          className="flex flex-col gap-1 rounded-md border border-destructive/40 p-3 text-sm text-destructive"
        >
          {bulkErrors.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-12 text-center">
          <p>{t("emptyFiltered")}</p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              setQ("");
              setStatus("ALL");
              sync("", "ALL");
            }}
          >
            {t("clearFilters")}
          </Button>
        </div>
      ) : (
        <>
          {/* Phones: one card per product. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {shown.map((row) => (
              <li key={row.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                <div className="flex gap-3">
                  <Thumb row={row} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="line-clamp-2 text-sm font-medium">{row.name[locale]}</p>
                    <StatusBadge status={row.status} label={ts(row.status)} />
                    <p className="text-sm tabular-nums">{price(row)}</p>
                  </div>
                </div>
                {row.reviewNote && (
                  <p className="rounded-md bg-muted p-2 text-xs">
                    <span className="font-semibold">{t("adminNote")}: </span>
                    {row.reviewNote}
                  </p>
                )}
                {actions(row)}
              </li>
            ))}
          </ul>

          {/* Desktop: a real table, so screen readers get headers per cell. */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th scope="col" className="p-3 font-medium">
                    {t("colProduct")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("colStatus")}
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    {t("colPrice")}
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    {t("colViews")}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t("colUpdated")}
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
                      <div className="flex items-center gap-3">
                        <Thumb row={row} />
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="line-clamp-2 font-medium">{row.name[locale]}</span>
                          <span className="text-xs text-muted-foreground">
                            {t("variants", { count: row.variantCount })}
                          </span>
                          {row.reviewNote && (
                            <span className="text-xs text-destructive">
                              {t("adminNote")}: {row.reviewNote}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                    <td className="p-3">
                      <StatusBadge status={row.status} label={ts(row.status)} />
                    </td>
                    <td className="p-3 text-right whitespace-nowrap tabular-nums">
                      {row.priceFrom === null ? "—" : formatPrice(row.priceFrom, locale)}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {row.views === null ? "—" : formatDecimal(String(row.views), locale)}
                    </td>
                    <td className="p-3 whitespace-nowrap tabular-nums">{updated(row.updatedAt)}</td>
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

function Thumb({ row }: { row: MerchantProductRow }) {
  return row.imageUrl ? (
    <Image
      src={row.imageUrl}
      alt=""
      width={56}
      height={70}
      className="h-[70px] w-14 shrink-0 rounded-md bg-muted object-cover"
    />
  ) : (
    <span aria-hidden className="h-[70px] w-14 shrink-0 rounded-md bg-muted" />
  );
}
