"use client";

import { Ban, Check, CheckCheck, CircleSlash, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  decisionSchema,
  NEEDS_REASON,
  REASON_MAX,
  REASON_MIN,
  type AdminAction,
} from "@/lib/admin/decisions";
import { errorKey } from "@/lib/admin/errors";
import { isMessage } from "@/lib/api/problem";
import { sendJson } from "@/lib/merchant/client";

const ICONS: Record<AdminAction, typeof Check> = {
  approve: Check,
  verify: Check,
  unblock: RotateCcw,
  reject: X,
  block: Ban,
  return: Undo2,
  deactivate: CircleSlash,
  resolve: CheckCheck,
  dismiss: X,
  accept: Check,
  discard: Trash2,
};

/**
 * The decision buttons of one row. Every decision is confirmed in a dialog;
 * the ones the seller must understand (reject, block, return, take down) also
 * ask for a reason, which is checked here and again by the route handler.
 */
export function DecisionButtons<S extends string>({
  endpoint,
  name,
  actions,
  onDone,
  reasonLabel,
  codes,
}: {
  endpoint: string;
  /** Who reads the reason; the default label says the seller does. */
  reasonLabel?: string;
  /** A required pick list next to the reason (e.g. why a document is refused). */
  codes?: { label: string; options: readonly { value: string; label: string }[] };
  name: string;
  actions: readonly AdminAction[];
  onDone: (result: { status: S; note: string | null }, action: AdminAction) => void;
}) {
  const t = useTranslations("Admin");
  const [action, setAction] = useState<AdminAction | null>(null);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const reasonId = useId();
  const errorId = useId();
  const codeId = useId();

  if (actions.length === 0) return null;

  function open(a: AdminAction) {
    setAction(a);
    setReason("");
    setCode("");
    setErrors({});
  }

  async function confirm() {
    if (!action) return;
    if (codes && NEEDS_REASON.has(action) && !code) {
      setErrors({ code: "codeRequired" });
      return;
    }
    const parsed = decisionSchema.safeParse({
      action,
      reason,
      code: codes && NEEDS_REASON.has(action) ? code : undefined,
    });
    if (!parsed.success) {
      setErrors({ reason: parsed.error.issues[0]?.message ?? "reasonRequired" });
      return;
    }
    setBusy(true);
    const result = await sendJson<{ status: S; note: string | null }>(
      "PATCH",
      endpoint,
      parsed.data,
    );
    setBusy(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const done = action;
    setAction(null);
    onDone(result.data, done);
  }

  const needsReason = action !== null && NEEDS_REASON.has(action);
  const formError = errors.form;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => {
        const Icon = ICONS[a];
        return (
          <Button
            key={a}
            type="button"
            size="lg"
            variant={NEEDS_REASON.has(a) ? "destructive" : "default"}
            aria-label={t("actions.named", { action: t(`actions.${a}`), name })}
            onClick={() => open(a)}
          >
            <Icon aria-hidden />
            {t(`actions.${a}`)}
          </Button>
        );
      })}

      <Dialog open={action !== null} onOpenChange={(o) => !o && !busy && setAction(null)}>
        {action && (
          <DialogContent closeLabel={t("confirm.close")}>
            <DialogHeader>
              <DialogTitle>{t(`confirm.${action}.title`, { name })}</DialogTitle>
              <DialogDescription>{t(`confirm.${action}.text`)}</DialogDescription>
            </DialogHeader>
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void confirm();
              }}
            >
              {needsReason && codes && (
                <div className="flex flex-col gap-1">
                  <label htmlFor={codeId} className="text-sm font-medium">
                    {codes.label}
                  </label>
                  <select
                    id={codeId}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    aria-invalid={errors.code ? true : undefined}
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
                  >
                    <option value="">{t("rejectReason.pick")}</option>
                    {codes.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {errors.code && (
                    <p className="text-xs text-destructive">
                      {t(`errors.${errorKey(errors.code)}`)}
                    </p>
                  )}
                </div>
              )}
              {needsReason && (
                <div className="flex flex-col gap-1">
                  <label htmlFor={reasonId} className="text-sm font-medium">
                    {reasonLabel ?? t("reason.label")}
                  </label>
                  <textarea
                    id={reasonId}
                    rows={4}
                    maxLength={REASON_MAX}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    aria-invalid={errors.reason ? true : undefined}
                    aria-describedby={errorId}
                    className="rounded-md border border-input bg-background p-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
                  />
                  <p id={errorId} className="text-xs text-muted-foreground">
                    {errors.reason ? (
                      <span className="text-destructive">
                        {t(`errors.${errorKey(errors.reason)}`)}
                      </span>
                    ) : (
                      t("reason.hint", { min: REASON_MIN, max: REASON_MAX })
                    )}
                  </p>
                </div>
              )}
              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {isMessage(formError) ? formError : t(`errors.${errorKey(formError)}`)}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setAction(null)}
                >
                  {t("confirm.cancel")}
                </Button>
                <Button
                  type="submit"
                  variant={needsReason ? "destructive" : "default"}
                  disabled={busy}
                  aria-busy={busy || undefined}
                >
                  {t(`actions.${action}`)}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
