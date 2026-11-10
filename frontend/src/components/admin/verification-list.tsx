"use client";

import { ExternalLink, FileText, Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CHECK_ACTIONS, DOCUMENT_REASONS } from "@/lib/admin/decisions";
import { sendJson } from "@/lib/merchant/client";
import { CHECK_FILTERS, filterList, shortDate } from "@/lib/admin/filter";
import { notices } from "@/lib/notice";
import type { CheckStatus } from "@/types/api";
import type { VerificationDocument, VerificationRequest } from "@/types/admin";
import { DecisionButtons } from "./decision-buttons";
import { EmptyFiltered, ListToolbar, useListFilter } from "./list-toolbar";
import { Note } from "./stores-list";

type Filter = (typeof CHECK_FILTERS)[number];

const VARIANT: Record<CheckStatus, "default" | "gold" | "destructive" | "outline"> = {
  PENDING: "gold",
  VERIFIED: "default",
  REJECTED: "destructive",
  NONE: "outline",
};

/**
 * Verification requests (PLAN 5.9): the admin opens each document, then grants
 * the check (the store gets the Jeparla Verified badge) or returns it with a reason.
 */
export function VerificationList({
  rows: initial,
  initialQuery,
  initialStatus,
  live = false,
}: {
  /** Real API: documents open through a signed link and refusals need a reason code. */
  live?: boolean;
  rows: VerificationRequest[];
  initialQuery: string;
  initialStatus: Filter;
}) {
  const t = useTranslations("Admin");
  const [rows, setRows] = useState(initial);
  const filter = useListFilter<Filter>(initialQuery, initialStatus, "PENDING");
  const shown = filterList(rows, filter.q, filter.status, (r) => `${r.store.name} ${r.store.city}`);

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        filter={filter}
        options={CHECK_FILTERS.map((s) => ({ value: s, label: t(`checkStatus.${s}`) }))}
        labels={{ search: t("checks.search"), status: t("statusLabel") }}
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("checks.count", { count: shown.length })}
      </p>

      {shown.length === 0 ? (
        <EmptyFiltered
          text={
            filter.status === "PENDING" && !filter.q ? t("checks.queueEmpty") : t("emptyFiltered")
          }
          clearLabel={t("clearFilters")}
          onClear={filter.clear}
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {shown.map((row) => (
            <li key={row.id} className="flex flex-col gap-4 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="flex items-center gap-2 text-sm text-gold-text">
                    <ShieldCheck aria-hidden className="size-4" />
                    {t(`checks.kind.${row.check}`)}
                  </p>
                  <h2 className="text-xl break-words">{row.store.name}</h2>
                  {row.product && (
                    <p className="text-sm break-words">
                      {t("checks.product", { name: row.product.name })}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {[row.store.city, t("submitted", { date: shortDate(row.submittedAt) })]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Badge variant={VARIANT[row.status]}>{t(`checkStatus.${row.status}`)}</Badge>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{t("checks.docs")}</h3>
                <ul className="flex flex-col gap-2">
                  {row.documents.map((doc) => (
                    <li key={doc.id}>
                      {live ? <LiveDocumentLink doc={doc} /> : <DocumentLink doc={doc} />}
                    </li>
                  ))}
                </ul>
              </div>

              {row.note && <Note label={t("note")} text={row.note} />}

              <DecisionButtons<CheckStatus>
                endpoint={`/api/admin/verifications/${row.id}`}
                name={row.store.name}
                actions={CHECK_ACTIONS[row.status]}
                codes={
                  live
                    ? {
                        label: t("rejectReason.label"),
                        options: DOCUMENT_REASONS.map((r) => ({
                          value: r,
                          label: t(`rejectReason.${r}`),
                        })),
                      }
                    : undefined
                }
                onDone={({ status, note }) => {
                  setRows((all) => all.map((r) => (r.id === row.id ? { ...r, status, note } : r)));
                  notices.show(
                    t("done", { name: row.store.name, status: t(`checkStatus.${status}`) }),
                  );
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Opens a document. Documents are private: the backend hands out a short-lived
 * signed link per view (and logs it). The demo has no files, so it says so.
 */
function DocumentLink({ doc }: { doc: VerificationDocument }) {
  const t = useTranslations("Admin");
  const label = t(`docKind.${doc.kind}`);
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="lg"
            className="h-auto w-full justify-start py-2 text-left"
            aria-label={t("checks.view", { name: label })}
          />
        }
      >
        <FileText aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{label}</span>
          <span className="truncate text-xs text-muted-foreground">
            {doc.pages === null
              ? doc.fileName
              : `${doc.fileName} · ${t("checks.pages", { count: doc.pages })}`}
          </span>
        </span>
      </DialogTrigger>
      <DialogContent closeLabel={t("confirm.close")}>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{t("checks.viewText")}</DialogDescription>
        </DialogHeader>
        <div className="flex aspect-[3/4] items-center justify-center rounded-md border border-dashed bg-muted text-sm text-muted-foreground">
          {doc.fileName}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Opens a real document: asks the API for a short-lived signed link (the view is written
 * to the audit log) and opens it in a new tab. The link is never stored in the page.
 */
function LiveDocumentLink({ doc }: { doc: VerificationDocument }) {
  const t = useTranslations("Admin");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const label = t(`docKind.${doc.kind}`);

  async function open() {
    setBusy(true);
    setFailed(false);
    // Opened before the await so the browser does not treat it as a pop-up.
    const tab = window.open("about:blank", "_blank");
    const result = await sendJson<{ url: string }>(
      "POST",
      `/api/admin/documents/${doc.id}/view`,
      {},
    );
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
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="lg"
        className="h-auto w-full justify-start py-2 text-left"
        aria-label={t("checks.view", { name: label })}
        disabled={busy}
        onClick={() => void open()}
      >
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : <FileText aria-hidden />}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{label}</span>
          <span className="truncate text-xs text-muted-foreground">{doc.fileName}</span>
        </span>
        <ExternalLink aria-hidden className="size-4" />
      </Button>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t("checks.viewFailed")}
        </p>
      )}
    </div>
  );
}
