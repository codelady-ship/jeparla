"use client";

import { Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { legalHoldSchema, LEGAL_HOLD_REASON_MAX, type LegalHold } from "@/lib/admin/legal-hold";
import { shortDate } from "@/lib/admin/filter";
import { notices } from "@/lib/notice";
import { cn } from "cn";
import { AdminDialog, Field, fieldClass, useAdminForm } from "./admin-dialog";

/**
 * Legal hold of a store's evidence (#138, #249): while it is on, the retention jobs delete or
 * pseudonymise nothing of the store. Internal: the seller never sees it. Placing it needs the
 * reason (e.g. the number of the authority's request); releasing it is confirmed.
 */
export function LegalHoldButton({
  storeId,
  name,
  heldAt,
  onChange,
}: {
  storeId: number;
  name: string;
  heldAt: string | null;
  onChange: (heldAt: string | null) => void;
}) {
  const t = useTranslations("Admin.legalHold");
  const ta = useTranslations("Admin");
  const form = useAdminForm();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [current, setCurrent] = useState<LegalHold | null>(null);
  const endpoint = `/api/admin/stores/${storeId}/legal-hold`;
  const held = heldAt !== null;

  async function show() {
    form.setErrors({});
    setReason("");
    setCurrent(null);
    setOpen(true);
    if (held) {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (res.ok) setCurrent((await res.json()) as LegalHold);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={ta("actions.named", { action: held ? t("release") : t("place"), name })}
        onClick={show}
        className={cn(held && "border-gold text-gold-text")}
      >
        <Scale aria-hidden />
        {held ? t("held") : t("place")}
      </Button>
      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title={held ? t("releaseTitle", { name }) : t("placeTitle", { name })}
        description={held ? t("releaseText") : t("placeText")}
        submitLabel={held ? t("release") : t("place")}
        destructive={held}
        busy={form.busy}
        formError={form.errors.form}
        onSubmit={async () => {
          const body = held ? { hold: false } : { hold: true, reason };
          const done = await form.submit<LegalHold, typeof legalHoldSchema>(
            "POST",
            endpoint,
            legalHoldSchema,
            body,
          );
          if (!done) return;
          setOpen(false);
          onChange(done.legalHoldAt);
          notices.show(done.legalHoldAt ? t("placed", { name }) : t("released", { name }));
        }}
      >
        {held ? (
          current && (
            <dl className="flex flex-col gap-1 rounded-md bg-muted p-3 text-sm">
              <dt className="font-medium">{t("since")}</dt>
              <dd className="tabular-nums">
                {current.legalHoldAt && shortDate(current.legalHoldAt)}
              </dd>
              <dt className="font-medium">{t("reason")}</dt>
              <dd className="break-words">{current.legalHoldReason}</dd>
            </dl>
          )
        ) : (
          <Field label={t("reason")} error={form.errors.reason} hint={t("reasonHint")}>
            {(props) => (
              <textarea
                {...props}
                rows={3}
                maxLength={LEGAL_HOLD_REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={cn(fieldClass, "h-auto py-2")}
              />
            )}
          </Field>
        )}
      </AdminDialog>
    </>
  );
}
