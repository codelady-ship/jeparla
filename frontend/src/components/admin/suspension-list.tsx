"use client";

import { Ban, ExternalLink, FileText, Loader2, X } from "lucide-react";
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
import { errorKey } from "@/lib/admin/errors";
import {
  NOTE_MAX,
  type StoreSuspension,
  type SuspensionDecision,
  type SuspensionStatus,
} from "@/lib/admin/suspensions";
import { isMessage } from "@/lib/api/problem";
import { sendJson } from "@/lib/merchant/client";

const BADGE: Record<SuspensionStatus, "gold" | "destructive" | "outline"> = {
  PENDING: "gold",
  CONFIRMED: "destructive",
  DISMISSED: "outline",
};

/**
 * The document that raised the suspicion: a short-lived signed link per view (the backend
 * writes each view to the audit log), opened in a new tab and never kept in the page.
 */
function DocumentButton({ id }: { id: string }) {
  const t = useTranslations("Admin");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function open() {
    setBusy(true);
    setFailed(false);
    // Opened before the await so the browser does not treat it as a pop-up.
    const tab = window.open("about:blank", "_blank");
    const result = await sendJson<{ url: string }>("POST", `/api/admin/documents/${id}/view`, {});
    setBusy(false);
    if (!result.ok || !tab) {
      tab?.close();
      setFailed(true);
      return;
    }
    tab.opener = null;
    tab.location.href = result.data.url;
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => void open()}>
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : <FileText aria-hidden />}
        {t("suspensions.openDocument")}
        <ExternalLink aria-hidden className="size-4" />
      </Button>
      {failed && (
        <span role="alert" className="text-xs text-destructive">
          {t("checks.viewFailed")}
        </span>
      )}
    </span>
  );
}

const when = (iso: string) => {
  const [date, time] = iso.split("T");
  return `${date.split("-").reverse().join(".")} ${time?.slice(0, 5) ?? ""}`.trim();
};

/**
 * Suspension requests (#138). A pending one shows who opened it and their internal note;
 * a second admin confirms or dismisses it in a dialog. The admin who opened it gets the
 * backend's four-eyes refusal, shown in plain words.
 */
export function SuspensionList({ rows: initial }: { rows: StoreSuspension[] }) {
  const t = useTranslations("Admin.suspensions");
  const ta = useTranslations("Admin");
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState<{
    row: StoreSuspension;
    decision: "CONFIRM" | "DISMISS";
  } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const noteId = useId();

  function start(row: StoreSuspension, decision: "CONFIRM" | "DISMISS") {
    setOpen({ row, decision });
    setNote("");
    setError(null);
  }

  async function decide() {
    if (!open) return;
    if (note.trim().length > NOTE_MAX) return setError("tooLong");
    setBusy(true);
    const body: SuspensionDecision = { decision: open.decision, note: note.trim() };
    const res = await sendJson<StoreSuspension>(
      "POST",
      `/api/admin/store-suspensions/${open.row.id}/decision`,
      body,
    );
    setBusy(false);
    if (!res.ok) return setError(res.errors.form ?? "server");
    setRows((all) => all.map((r) => (r.id === res.data.id ? res.data : r)));
    setDone(
      t(open.decision === "CONFIRM" ? "doneConfirm" : "doneDismiss", { name: open.row.storeName }),
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
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{r.storeName}</p>
                <Badge variant={BADGE[r.status]}>{t(`status.${r.status}`)}</Badge>
              </div>
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-muted-foreground">{t("requested")}</dt>
                <dd>
                  {t("byAdmin", {
                    date: when(r.requestedAt),
                    admin: r.requestedBy ?? t("deletedAccount"),
                  })}
                </dd>
                {r.documentId && (
                  <>
                    <dt className="text-muted-foreground">{t("document")}</dt>
                    <dd>
                      <DocumentButton id={r.documentId} />
                    </dd>
                  </>
                )}
                {r.note && (
                  <>
                    <dt className="text-muted-foreground">{t("internalNote")}</dt>
                    <dd className="whitespace-pre-line">{r.note}</dd>
                  </>
                )}
                {r.decidedAt && (
                  <>
                    <dt className="text-muted-foreground">{t("decided")}</dt>
                    <dd>
                      {t("byAdmin", {
                        date: when(r.decidedAt),
                        admin: r.decidedBy ?? t("deletedAccount"),
                      })}
                    </dd>
                  </>
                )}
                {r.decisionNote && (
                  <>
                    <dt className="text-muted-foreground">{t("decisionNote")}</dt>
                    <dd className="whitespace-pre-line">{r.decisionNote}</dd>
                  </>
                )}
              </dl>
              {r.status === "PENDING" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="lg"
                    variant="destructive"
                    aria-label={t("confirmNamed", { name: r.storeName })}
                    onClick={() => start(r, "CONFIRM")}
                  >
                    <Ban aria-hidden />
                    {t("confirm")}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    aria-label={t("dismissNamed", { name: r.storeName })}
                    onClick={() => start(r, "DISMISS")}
                  >
                    <X aria-hidden />
                    {t("dismiss")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && !busy && setOpen(null)}>
        {open && (
          <DialogContent closeLabel={ta("confirm.close")}>
            <DialogHeader>
              <DialogTitle>
                {t(open.decision === "CONFIRM" ? "confirmTitle" : "dismissTitle", {
                  name: open.row.storeName,
                })}
              </DialogTitle>
              <DialogDescription>
                {t(open.decision === "CONFIRM" ? "confirmText" : "dismissText")}
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
                <label htmlFor={noteId} className="text-sm font-medium">
                  {t("noteLabel")}
                </label>
                <textarea
                  id={noteId}
                  rows={3}
                  maxLength={NOTE_MAX}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="rounded-md border border-input bg-background p-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <p className="text-xs text-muted-foreground">{t("noteHint")}</p>
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
                <Button
                  type="submit"
                  variant={open.decision === "CONFIRM" ? "destructive" : "default"}
                  disabled={busy}
                  aria-busy={busy || undefined}
                >
                  {t(open.decision === "CONFIRM" ? "confirm" : "dismiss")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
