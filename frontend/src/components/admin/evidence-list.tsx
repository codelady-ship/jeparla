"use client";

import { Check, ExternalLink, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { errorKey } from "@/lib/admin/errors";
import {
  REASON_MAX,
  REASON_MIN,
  type AdminEvidencePhoto,
  type EvidenceCheck,
  type EvidenceStatus,
} from "@/lib/admin/evidence";
import { isMessage } from "@/lib/api/problem";
import { sendJson } from "@/lib/merchant/client";

const BADGE: Record<EvidenceStatus, "gold" | "destructive" | "secondary"> = {
  PENDING: "gold",
  VERIFIED: "secondary",
  REJECTED: "destructive",
};

type Decision = EvidenceCheck["decision"];

/**
 * Hallmark and label photos waiting for the check (#106). Each photo sits next to the data it
 * is compared with (metal, fineness, weights). VERIFIED takes an optional note, REJECTED a
 * reason of 10+ characters that the seller sees.
 */
export function EvidenceList({ rows: initial }: { rows: AdminEvidencePhoto[] }) {
  const t = useTranslations("Admin.evidence");
  const ta = useTranslations("Admin");
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState<{ row: AdminEvidencePhoto; decision: Decision } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const reasonId = useId();

  function start(row: AdminEvidencePhoto, decision: Decision) {
    setOpen({ row, decision });
    setReason("");
    setError(null);
  }

  async function decide() {
    if (!open) return;
    const text = reason.trim();
    if (open.decision === "REJECTED" && text.length < REASON_MIN) return setError("reasonRequired");
    if (text.length > REASON_MAX) return setError("reasonTooLong");
    setBusy(true);
    const body: EvidenceCheck = { decision: open.decision, reason: text };
    const res = await sendJson<AdminEvidencePhoto>(
      "POST",
      `/api/admin/evidence-photos/${open.row.id}/check`,
      body,
    );
    setBusy(false);
    if (!res.ok) return setError(res.errors.reason ?? res.errors.form ?? "server");
    setRows((all) => all.map((r) => (r.id === res.data.id ? res.data : r)));
    setDone(
      t(open.decision === "VERIFIED" ? "doneVerified" : "doneRejected", {
        name: open.row.productName,
      }),
    );
    setOpen(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm" aria-live="polite">
        {done}
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const kind = t(`kind.${r.kind}`);
            return (
              <li
                key={r.id}
                className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[minmax(0,16rem)_1fr]"
              >
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block aspect-square overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-label={t("openPhoto", { kind, name: r.productName })}
                >
                  <Image
                    src={r.url}
                    alt={t("alt", { kind, name: r.productName })}
                    fill
                    sizes="(min-width: 640px) 16rem, 100vw"
                    className="object-contain"
                    unoptimized
                  />
                </a>
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{r.productName}</p>
                    <Badge variant="outline">{kind}</Badge>
                    <Badge variant={BADGE[r.status]}>{t(`status.${r.status}`)}</Badge>
                  </div>
                  <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                    <dt className="text-muted-foreground">{t("store")}</dt>
                    <dd>{r.storeName}</dd>
                    <dt className="text-muted-foreground">{t("metal")}</dt>
                    <dd>{r.metal ? ta(`metal.${r.metal}`) : t("fashion")}</dd>
                    <dt className="text-muted-foreground">{t("fineness")}</dt>
                    <dd className="tabular-nums">
                      {r.finenesses.length ? r.finenesses.join(", ") : t("none")}
                    </dd>
                    <dt className="text-muted-foreground">{t("weights")}</dt>
                    <dd className="tabular-nums">
                      {r.weightsGrams.length
                        ? r.weightsGrams.map((w) => t("grams", { value: w })).join(", ")
                        : t("none")}
                    </dd>
                    {r.checkNote && (
                      <>
                        <dt className="text-muted-foreground">{t("note")}</dt>
                        <dd className="whitespace-pre-line">{r.checkNote}</dd>
                      </>
                    )}
                  </dl>
                  <p className="text-xs text-muted-foreground">{t("compareHint")}</p>
                  <div className="flex flex-wrap gap-2">
                    {r.status !== "VERIFIED" && (
                      <Button
                        type="button"
                        size="lg"
                        aria-label={t("verifyNamed", { kind, name: r.productName })}
                        onClick={() => start(r, "VERIFIED")}
                      >
                        <Check aria-hidden />
                        {t("verify")}
                      </Button>
                    )}
                    {r.status !== "REJECTED" && (
                      <Button
                        type="button"
                        size="lg"
                        variant="outline"
                        aria-label={t("rejectNamed", { kind, name: r.productName })}
                        onClick={() => start(r, "REJECTED")}
                      >
                        <X aria-hidden />
                        {t("reject")}
                      </Button>
                    )}
                    <Link
                      href={`/admin/products?q=${encodeURIComponent(r.productName)}`}
                      className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {t("toProduct")}
                      <ExternalLink aria-hidden className="size-4" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && !busy && setOpen(null)}>
        {open && (
          <DialogContent closeLabel={ta("confirm.close")}>
            <DialogHeader>
              <DialogTitle>
                {t(open.decision === "VERIFIED" ? "verifyTitle" : "rejectTitle", {
                  kind: t(`kind.${open.row.kind}`),
                  name: open.row.productName,
                })}
              </DialogTitle>
              <DialogDescription>
                {t(open.decision === "VERIFIED" ? "verifyText" : "rejectText")}
              </DialogDescription>
            </DialogHeader>
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void decide();
              }}
            >
              <div className="flex flex-col gap-1">
                <label htmlFor={reasonId} className="text-sm font-medium">
                  {t(open.decision === "VERIFIED" ? "noteLabel" : "reasonLabel")}
                </label>
                <textarea
                  id={reasonId}
                  rows={3}
                  maxLength={REASON_MAX}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  className="rounded-md border border-input bg-background p-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <p className="text-xs text-muted-foreground">
                  {t(open.decision === "VERIFIED" ? "noteHint" : "reasonHint")}
                </p>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {isMessage(error) ? error : ta(`errors.${errorKey(error)}`)}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setOpen(null)}
                >
                  {ta("confirm.cancel")}
                </Button>
                <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
                  {t(open.decision === "VERIFIED" ? "verify" : "reject")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
