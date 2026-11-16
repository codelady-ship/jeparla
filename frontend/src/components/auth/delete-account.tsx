"use client";

import { Loader2, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { isMessage } from "@/lib/api/problem";
import { sendJson } from "@/lib/merchant/client";
import { notices } from "@/lib/notice";

const KNOWN = [
  "unavailable",
  "sessionExpired",
  "rateLimited",
  "network",
  "server",
  "required",
] as const;

/**
 * Self-service account deletion (#249): the password again, then a confirmation. The backend
 * refuses a store owner and an administrator with a sentence in the visitor's language.
 */
export function DeleteAccount() {
  const t = useTranslations("Account");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordId = useId();
  const errorId = useId();

  const message = (code: string) => {
    if (isMessage(code)) return code;
    const known = KNOWN.find((k) => k === code) ?? "server";
    return t(`errors.${known}`);
  };

  async function remove() {
    if (!password) return setError("required");
    setBusy(true);
    setError(null);
    const res = await sendJson("DELETE", "/api/auth/account", { password });
    setBusy(false);
    if (!res.ok) return setError(res.errors.password ?? res.errors.form ?? "server");
    setOpen(false);
    notices.show(t("deleted"));
    router.replace("/");
    router.refresh();
  }

  return (
    <section aria-labelledby="delete-account" className="flex flex-col gap-3 rounded-lg border p-5">
      <h2 id="delete-account" className="text-xl">
        {t("deleteTitle")}
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
        <li>{t("deleteGoes")}</li>
        <li>{t("deleteStays")}</li>
        <li>{t("deleteStore")}</li>
      </ul>
      <Button
        type="button"
        variant="destructive"
        className="h-11 self-start"
        onClick={() => {
          setPassword("");
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden />
        {t("deleteButton")}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        {open && (
          <DialogContent closeLabel={t("cancel")}>
            <DialogHeader>
              <DialogTitle>{t("confirmTitle")}</DialogTitle>
              <DialogDescription>{t("confirmText")}</DialogDescription>
            </DialogHeader>
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor={passwordId}>{t("password")}</Label>
                <Input
                  id={passwordId}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="h-11"
                />
                {error && (
                  <p id={errorId} role="alert" className="text-sm text-destructive">
                    {message(error)}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" variant="destructive" disabled={busy} aria-busy={busy}>
                  {busy && <Loader2 aria-hidden className="animate-spin" />}
                  {t("confirmButton")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
