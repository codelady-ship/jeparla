"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorKey } from "@/lib/admin/errors";
import { isMessage } from "@/lib/api/problem";
import { fieldErrors } from "@/lib/admin/settings";
import { sendJson } from "@/lib/merchant/client";

/**
 * State of one admin form: the body is checked with the same schema the route
 * handler uses, then sent; field errors come back as { field: code }.
 */
export function useAdminForm() {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit<T, S extends z.ZodType>(
    method: string,
    endpoint: string,
    schema: S,
    body: unknown,
  ): Promise<T | null> {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return null;
    }
    setErrors({});
    setBusy(true);
    const result = await sendJson<T>(method, endpoint, parsed.data);
    setBusy(false);
    if (!result.ok) {
      setErrors(result.errors);
      return null;
    }
    return result.data;
  }

  return { busy, errors, setErrors, submit };
}

/**
 * Confirm or form dialog of the panel: title, explanation, optional fields, a
 * form-level error and the two buttons. Closing is blocked while a request runs.
 */
export function AdminDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  destructive = false,
  busy,
  formError,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  destructive?: boolean;
  busy: boolean;
  formError?: string;
  onSubmit: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations("Admin");
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      {open && (
        <DialogContent closeLabel={t("confirm.close")}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {children}
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
                onClick={() => onOpenChange(false)}
              >
                {t("confirm.cancel")}
              </Button>
              <Button
                type="submit"
                variant={destructive ? "destructive" : "default"}
                disabled={busy}
                aria-busy={busy || undefined}
              >
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

export const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

/**
 * Label, control and either the error or the hint under it. The control gets
 * its id, aria-invalid and aria-describedby from the render function.
 */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (props: {
    id: string;
    "aria-invalid": true | undefined;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}) {
  const t = useTranslations("Admin");
  const id = useId();
  const noteId = useId();
  const hasNote = Boolean(error || hint);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": hasNote ? noteId : undefined,
      })}
      {hasNote && (
        <p id={noteId} className="text-xs text-muted-foreground">
          {error ? (
            <span className="text-destructive">
              {isMessage(error) ? error : t(`errors.${errorKey(error)}`)}
            </span>
          ) : (
            hint
          )}
        </p>
      )}
    </div>
  );
}

/** Reason textarea shared by role changes and price overrides (kept in the audit log). */
export function ReasonField({
  label,
  hint,
  value,
  onChange,
  error,
  max,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  max: number;
}) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(props) => (
        <textarea
          {...props}
          rows={3}
          maxLength={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-md border border-input bg-background p-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
      )}
    </Field>
  );
}
