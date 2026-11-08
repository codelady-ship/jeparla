"use client";

import { PencilLine, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QUOTE_ACTIONS, REASON_MAX, REASON_MIN } from "@/lib/admin/decisions";
import { shortDate } from "@/lib/admin/filter";
import { overrideSchema, priceJump, SANITY_LIMIT } from "@/lib/admin/settings";
import { formatDecimal, formatPrice } from "@/lib/money";
import { gramPrice } from "@/lib/pricing";
import { notices } from "@/lib/notice";
import type { AdminMetalPrice, QuoteStatus } from "@/types/admin";
import type { Decimal } from "@/types/api";
import { AdminDialog, Field, fieldClass, ReasonField, useAdminForm } from "./admin-dialog";
import { DecisionButtons } from "./decision-buttons";

/** "+1,2%" / "-0.4%" in the page locale. */
function useSignedPercent() {
  const locale = useLocale();
  return (v: Decimal) =>
    `${v.startsWith("-") ? "" : "+"}${formatDecimal(v, locale, { min: 1, max: 1 })}%`;
}

/**
 * Metal price monitoring (PLAN 5.8, 5.10): the CBAR price in use per metal, a
 * quote held by the sanity check (daily change above 10%) to apply or discard,
 * and a manual override with a reason. Every change lands in the audit log.
 */
export function MetalPrices({ rows: initial }: { rows: AdminMetalPrice[] }) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const signed = useSignedPercent();
  const [rows, setRows] = useState(initial);
  const update = (metal: string, patch: Partial<AdminMetalPrice>) =>
    setRows((all) => all.map((r) => (r.metal === metal ? { ...r, ...patch } : r)));

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {rows.map((row) => {
        const metal = t(`metal.${row.metal}`);
        const held = row.held?.status === "HELD" ? row.held : null;
        return (
          <li key={row.metal} className="flex flex-col gap-4 rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl">{metal}</h2>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t("prices.date", { date: shortDate(row.date) })}
                </p>
              </div>
              <Badge variant={row.source === "ADMIN" ? "gold" : "outline"}>
                {t(`prices.source.${row.source}`)}
              </Badge>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{t("prices.perOunce")}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatPrice(row.pricePerOunce, locale)}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{t("prices.perGram")}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatPrice(row.pricePerGram, locale)}
                </dd>
              </div>
              <div className="col-span-2 flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{t("prices.change")}</dt>
                <dd className="tabular-nums">{signed(row.change)}</dd>
              </div>
            </dl>

            {held && (
              <div
                role="status"
                className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3"
              >
                <p className="flex items-start gap-2 text-sm">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <span>
                    {t("prices.held", {
                      date: shortDate(held.date),
                      price: formatPrice(held.pricePerOunce, locale),
                      change: signed(held.change),
                      limit: SANITY_LIMIT,
                    })}
                  </span>
                </p>
                <DecisionButtons<QuoteStatus>
                  endpoint={`/api/admin/metal-prices/${row.metal}`}
                  name={metal}
                  actions={QUOTE_ACTIONS[held.status]}
                  reasonLabel={t("reason.audit")}
                  onDone={({ status }) => {
                    update(
                      row.metal,
                      status === "APPLIED"
                        ? {
                            held: null,
                            date: held.date,
                            previousPerOunce: row.pricePerOunce,
                            pricePerOunce: held.pricePerOunce,
                            pricePerGram: gramPrice(held.pricePerOunce),
                            change: held.change,
                          }
                        : { held: null },
                    );
                    notices.show(t("done", { name: metal, status: t(`quoteStatus.${status}`) }));
                  }}
                />
              </div>
            )}

            <OverrideButton
              row={row}
              onDone={(next) => update(row.metal, { ...next, source: "ADMIN" })}
            />
          </li>
        );
      })}
    </ul>
  );
}

type OverrideResult = Pick<AdminMetalPrice, "pricePerOunce" | "pricePerGram" | "change">;

function OverrideButton({
  row,
  onDone,
}: {
  row: AdminMetalPrice;
  onDone: (next: OverrideResult & { previousPerOunce: Decimal }) => void;
}) {
  const t = useTranslations("Admin");
  const locale = useLocale();
  const signed = useSignedPercent();
  const metal = t(`metal.${row.metal}`);
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [confirmLarge, setConfirmLarge] = useState(false);
  const form = useAdminForm();
  const checkId = useId();

  const parsed = overrideSchema.shape.pricePerOunce.safeParse(price);
  const jump = parsed.success ? priceJump(row.pricePerOunce, parsed.data) : null;

  async function save() {
    if (jump?.large && !confirmLarge) {
      form.setErrors({ pricePerOunce: "largeChange" });
      return;
    }
    const done = await form.submit<OverrideResult, typeof overrideSchema>(
      "PUT",
      `/api/admin/metal-prices/${row.metal}`,
      overrideSchema,
      { pricePerOunce: price, reason, confirmLarge },
    );
    if (!done) return;
    setOpen(false);
    onDone({ ...done, previousPerOunce: row.pricePerOunce });
    notices.show(t("prices.overridden", { name: metal }));
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="self-start"
        aria-label={t("actions.named", { action: t("prices.override"), name: metal })}
        onClick={() => {
          setPrice("");
          setReason("");
          setConfirmLarge(false);
          form.setErrors({});
          setOpen(true);
        }}
      >
        <PencilLine aria-hidden />
        {t("prices.override")}
      </Button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title={t("prices.overrideTitle", { name: metal })}
        description={t("prices.overrideText", {
          price: formatPrice(row.pricePerOunce, locale),
        })}
        submitLabel={t("prices.override")}
        destructive
        busy={form.busy}
        formError={form.errors.form}
        onSubmit={() => void save()}
      >
        <Field
          label={t("prices.newPrice")}
          error={form.errors.pricePerOunce}
          hint={
            jump ? t("prices.newChange", { change: signed(jump.change) }) : t("prices.priceHint")
          }
        >
          {(props) => (
            <input
              {...props}
              inputMode="decimal"
              value={price}
              maxLength={10}
              onChange={(e) => {
                setPrice(e.target.value);
                setConfirmLarge(false);
              }}
              className={fieldClass}
            />
          )}
        </Field>
        {jump?.large && (
          <div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
            <p className="flex items-start gap-2">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
              {t("prices.largeWarning", { change: signed(jump.change), limit: SANITY_LIMIT })}
            </p>
            <label htmlFor={checkId} className="flex min-h-11 items-center gap-2 font-medium">
              <input
                id={checkId}
                type="checkbox"
                checked={confirmLarge}
                onChange={(e) => setConfirmLarge(e.target.checked)}
                className="size-5 accent-primary"
              />
              {t("prices.confirmLarge")}
            </label>
          </div>
        )}
        <ReasonField
          label={t("reason.audit")}
          hint={t("reason.hint", { min: REASON_MIN, max: REASON_MAX })}
          value={reason}
          onChange={setReason}
          error={form.errors.reason}
          max={REASON_MAX}
        />
      </AdminDialog>
    </>
  );
}
