"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isMessage } from "@/lib/api/problem";
import { sendJson } from "@/lib/merchant/client";
import type { MetalSiblings } from "@/lib/merchant/metal-sibling";
import type { MetalType } from "@/types/api";

/**
 * Same design in another metal (V69, owner decision 2026-11-25): on the edit page the seller links
 * this product with one of the store's products in another metal. The product page then shows a
 * Qızıl / Gümüş switch; each product keeps its own photos, prices and on-model image.
 */
export function MetalSiblingPicker({
  productId,
  initial,
  metalNames,
}: {
  productId: number;
  initial: MetalSiblings;
  metalNames: Record<MetalType, string>;
}) {
  const t = useTranslations("Merchant.form.metalSibling");
  const id = useId();
  const [saved, setSaved] = useState<number | null>(initial.siblingId);
  const [value, setValue] = useState(initial.siblingId === null ? "" : String(initial.siblingId));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  if (initial.options.length === 0 && initial.siblingId === null) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const siblingId = value === "" ? null : Number(value);
    const result = await sendJson<MetalSiblings>(
      "PUT",
      `/api/merchant/products/${productId}/metal-sibling`,
      { siblingId },
    );
    setBusy(false);
    if (!result.ok) {
      const text = result.errors.siblingId ?? result.errors.form;
      setStatus({ ok: false, text: text && isMessage(text) ? text : t("error") });
      return;
    }
    setSaved(result.data.siblingId);
    setStatus({ ok: true, text: result.data.siblingId === null ? t("removed") : t("saved") });
  }

  return (
    <form
      onSubmit={save}
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-lg">
          {t("title")}
        </h2>
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {t("hint")}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor={`${id}-select`}>{t("label")}</Label>
          <select
            id={`${id}-select`}
            aria-describedby={`${id}-hint`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 rounded-md border border-input bg-background px-3 text-base"
          >
            <option value="">{t("none")}</option>
            {initial.options.map((o) => (
              <option key={o.id} value={o.id}>
                {`${o.name} · ${metalNames[o.metal]}${o.linkedElsewhere ? ` · ${t("linkedElsewhere")}` : ""}`}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="submit"
          size="lg"
          variant="outline"
          className="h-11"
          disabled={busy || value === (saved === null ? "" : String(saved))}
        >
          {busy && <Loader2 aria-hidden className="animate-spin" />}
          {t("save")}
        </Button>
      </div>
      <p
        role="status"
        className={
          status?.ok === false ? "text-sm text-destructive" : "text-sm text-muted-foreground"
        }
      >
        {status?.text}
      </p>
    </form>
  );
}
