"use client";

import { AlertCircle, Check, Loader2, Save, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/routing";
import { isMessage } from "@/lib/api/problem";
import { sendJson } from "@/lib/merchant/client";
import {
  QUICK_METALS,
  quickErrors,
  sameQuick,
  type QuickFields,
  type QuickRow,
} from "@/lib/merchant/quick-edit";
import type { Decimal, ProductStatus } from "@/types/api";
import type { MerchantProductRow } from "@/types/merchant";

export type QuickOption = { value: string; label: string };
export type QuickFineness = QuickOption & { metal: string };
export type QuickSaved = {
  id: number;
  status: ProductStatus;
  categoryId: number | null;
  priceFrom: Decimal | null;
};

type RowState = {
  saved: QuickRow;
  edit: QuickFields;
  state: "idle" | "saving" | "saved" | "error";
  /** Field (or "form") to message key or the backend's own sentence. */
  errors: Record<string, string>;
};

const COLS = ["category", "metal", "fineness", "weightGrams", "pricingMode"] as const;
type Col = (typeof COLS)[number];

const select =
  "h-9 w-full min-w-28 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive";

/** Backend field path (variants.0.weightGrams, categoryId ...) to the quick-edit column. */
function columnOf(path: string): Col | "form" {
  if (path.endsWith("weightGrams")) return "weightGrams";
  if (path.endsWith("finenessId")) return "fineness";
  if (path === "categoryId" || path === "category") return "category";
  if (path === "metal") return "metal";
  if (path.endsWith("pricingMode") || path.endsWith("rule")) return "pricingMode";
  return "form";
}

/**
 * Quick editing of drafts in the products table (#109): category, metal, fineness, weight and
 * price mode, row by row. Enter saves the row and moves to the same field of the next row,
 * Shift+Enter goes up, Escape undoes the row; leaving a changed row saves it too. Each row is
 * saved on its own; a row that fails keeps the seller's values and says why.
 */
export function DraftQuickEdit({
  drafts,
  categories,
  finenesses,
  onSaved,
}: {
  drafts: MerchantProductRow[];
  categories: QuickOption[];
  finenesses: QuickFineness[];
  onSaved: (saved: QuickSaved) => void;
}) {
  const t = useTranslations("Merchant.products.quick");
  const tp = useTranslations("Merchant.products.bulkPricing");
  const tm = useTranslations("Merchant");
  const tmetal = useTranslations("Product.metal");
  const locale = useLocale() as Locale;
  const [rows, setRows] = useState<Map<number, RowState> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [announce, setAnnounce] = useState("");
  const table = useRef<HTMLTableElement>(null);
  const inFlight = useRef(new Set<number>());
  const ids = drafts.map((d) => d.id).join(",");

  useEffect(() => {
    let live = true;
    fetch(`/api/merchant/products/quick?ids=${ids}`)
      .then((r) => (r.ok ? (r.json() as Promise<QuickRow[]>) : Promise.reject()))
      .then((list) => {
        if (!live) return;
        setRows(
          new Map(
            list.map((saved) => [saved.id, { saved, edit: saved, state: "idle", errors: {} }]),
          ),
        );
      })
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
    };
  }, [ids]);

  const message = (k: string) => {
    if (isMessage(k)) return k;
    if (t.has(`errors.${k}` as "errors.required")) return t(`errors.${k}` as "errors.required");
    if (tm.has(`errors.${k}` as "errors.server")) return tm(`errors.${k}` as "errors.server");
    return tm("errors.server");
  };

  const patch = (id: number, fn: (r: RowState) => RowState) =>
    setRows((m) => {
      const r = m?.get(id);
      if (!m || !r) return m;
      return new Map(m).set(id, fn(r));
    });

  const nameOf = (id: number) => drafts.find((d) => d.id === id)?.name[locale] ?? String(id);

  async function save(id: number) {
    const row = rows?.get(id);
    // Enter saves and moves focus, which also fires the row's blur: one request, not two.
    if (!row || inFlight.current.has(id) || sameQuick(row.edit, row.saved)) return;
    const invalid = quickErrors(row.edit, row.saved.fashion);
    if (invalid) {
      patch(id, (r) => ({ ...r, state: "error", errors: invalid }));
      setAnnounce(t("rowInvalid", { name: nameOf(id) }));
      return;
    }
    const sent = row.edit;
    inFlight.current.add(id);
    patch(id, (r) => ({ ...r, state: "saving", errors: {} }));
    const res = await sendJson<QuickSaved>("PATCH", `/api/merchant/products/${id}/quick`, sent);
    inFlight.current.delete(id);
    if (!res.ok) {
      const errors: Record<string, string> = {};
      for (const [path, msg] of Object.entries(res.errors)) errors[columnOf(path)] ??= msg;
      errors.form ??= "server";
      patch(id, (r) => ({ ...r, state: "error", errors }));
      setAnnounce(t("rowFailed", { name: nameOf(id) }));
      return;
    }
    // Later edits made while saving stay as unsaved changes.
    patch(id, (r) => ({
      ...r,
      saved: { ...r.saved, ...sent },
      state: sameQuick(r.edit, sent) ? "saved" : "idle",
      errors: {},
    }));
    setAnnounce(t("rowSaved", { name: nameOf(id) }));
    onSaved(res.data);
  }

  function revert(id: number) {
    patch(id, (r) => ({ ...r, edit: r.saved, state: "idle", errors: {} }));
  }

  /** Focus the same field `step` rows away; a disabled field falls back to the row's first. */
  function move(rowIndex: number, col: number, step: number) {
    const next = rowIndex + step;
    const root = table.current;
    if (!root) return;
    const target =
      root.querySelector<HTMLElement>(`[data-row="${next}"][data-col="${col}"]:not(:disabled)`) ??
      root.querySelector<HTMLElement>(`[data-row="${next}"]:not(:disabled)`);
    target?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableElement>) {
    const el = e.target as HTMLElement;
    const rowIndex = Number(el.dataset.row);
    const col = Number(el.dataset.col);
    const id = Number(el.dataset.id);
    if (!Number.isInteger(rowIndex) || !Number.isInteger(id)) return;
    if (e.key === "Enter") {
      e.preventDefault();
      void save(id);
      move(rowIndex, col, e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      revert(id);
    } else if (el.tagName === "INPUT" && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      void save(id);
      move(rowIndex, col, e.key === "ArrowDown" ? 1 : -1);
    }
  }

  if (loadFailed)
    return (
      <p role="alert" className="text-sm text-destructive">
        {t("loadFailed")}
      </p>
    );
  if (!rows)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        {t("loading")}
      </p>
    );

  const list = drafts.filter((d) => rows.has(d.id));
  if (list.length === 0) return <p className="text-sm text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t("keys")}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table ref={table} className="w-full text-sm" onKeyDown={onKeyDown}>
          <thead className="bg-muted text-left">
            <tr>
              <th scope="col" className="p-2 font-medium">
                {t("colProduct")}
              </th>
              {COLS.map((c) => (
                <th key={c} scope="col" className="p-2 font-medium">
                  {t(`col.${c}`)}
                </th>
              ))}
              <th scope="col" className="p-2 font-medium">
                {t("colState")}
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((d, i) => {
              const r = rows.get(d.id) as RowState;
              const name = d.name[locale];
              const f = r.edit;
              const dirty = !sameQuick(f, r.saved);
              const fashion = r.saved.fashion;
              const locked = r.state === "saving";
              const set = (p: Partial<QuickFields>) =>
                patch(d.id, (x) => ({
                  ...x,
                  edit: { ...x.edit, ...p },
                  state: x.state === "saved" ? "idle" : x.state,
                }));
              const cell = (c: Col) => ({
                "data-row": i,
                "data-col": COLS.indexOf(c),
                "data-id": d.id,
                "aria-label": t("fieldOf", { field: t(`col.${c}`), name }),
                "aria-invalid": r.errors[c] ? true : undefined,
                disabled: locked,
              });
              const fieldErrors = COLS.filter((c) => r.errors[c]).map(
                (c) => `${t(`col.${c}`)}: ${message(r.errors[c])}`,
              );
              return (
                <tr
                  key={d.id}
                  className="border-t align-top data-[error=true]:bg-destructive/5"
                  data-error={r.state === "error"}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void save(d.id);
                  }}
                >
                  <th scope="row" className="max-w-48 p-2 text-left font-medium">
                    <span className="line-clamp-2">{name}</span>
                  </th>
                  <td className="p-2">
                    <select
                      {...cell("category")}
                      value={f.category}
                      onChange={(e) => set({ category: e.target.value })}
                      className={select}
                    >
                      <option value="">{t("choose")}</option>
                      {categories.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    {fashion ? (
                      <span className="text-xs text-muted-foreground">{t("fashion")}</span>
                    ) : (
                      <select
                        {...cell("metal")}
                        value={f.metal}
                        onChange={(e) => {
                          const metal = e.target.value as QuickFields["metal"];
                          const keep = finenesses.some(
                            (o) => o.value === f.fineness && o.metal === metal,
                          );
                          set({ metal, fineness: keep ? f.fineness : "" });
                        }}
                        className={select}
                      >
                        <option value="">{t("choose")}</option>
                        {QUICK_METALS.map((m) => (
                          <option key={m} value={m}>
                            {tmetal(m)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="p-2">
                    {fashion ? (
                      <span className="text-xs text-muted-foreground">{t("fashion")}</span>
                    ) : (
                      <select
                        {...cell("fineness")}
                        value={f.fineness}
                        disabled={locked || !f.metal}
                        onChange={(e) => set({ fineness: e.target.value })}
                        className={select}
                      >
                        <option value="">{t("choose")}</option>
                        {finenesses
                          .filter((o) => o.metal === f.metal)
                          .map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                      </select>
                    )}
                  </td>
                  <td className="p-2">
                    {r.saved.variantCount === 1 ? (
                      <Input
                        {...cell("weightGrams")}
                        inputMode="decimal"
                        value={f.weightGrams}
                        onChange={(e) => set({ weightGrams: e.target.value })}
                        className="h-9 w-24"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("manyVariants", { count: r.saved.variantCount })}
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <select
                      {...cell("pricingMode")}
                      value={f.pricingMode}
                      disabled={locked || fashion}
                      onChange={(e) =>
                        set({ pricingMode: e.target.value as QuickFields["pricingMode"] })
                      }
                      className={select}
                    >
                      <option value="FIXED">{tp("FIXED")}</option>
                      <option value="METAL_LINKED">{tp("METAL_LINKED")}</option>
                    </select>
                  </td>
                  <td className="min-w-44 p-2 text-xs">
                    <div className="flex flex-col gap-1">
                      {r.state === "saving" ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Loader2 aria-hidden className="size-3.5 animate-spin" />
                          {t("saving")}
                        </span>
                      ) : r.state === "error" ? (
                        <span className="flex items-start gap-1 text-destructive">
                          <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
                          <span>
                            {fieldErrors.length > 0
                              ? fieldErrors.join(" ")
                              : message(r.errors.form ?? "server")}
                          </span>
                        </span>
                      ) : dirty ? (
                        <span className="text-muted-foreground">{t("unsaved")}</span>
                      ) : r.state === "saved" ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Check aria-hidden className="size-3.5 text-success" />
                          {t("saved")}
                        </span>
                      ) : null}
                      {dirty && !locked && (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => void save(d.id)}
                            aria-label={t("saveNamed", { name })}
                          >
                            <Save aria-hidden />
                            {t("save")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => revert(d.id)}
                            aria-label={t("undoNamed", { name })}
                          >
                            <Undo2 aria-hidden />
                            {t("undo")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
