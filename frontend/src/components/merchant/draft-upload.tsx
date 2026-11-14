"use client";

import { Camera, FileText, ImagePlus, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ChangeEvent } from "react";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import {
  DRAFT_PDF_MAX_BYTES,
  DRAFT_PHOTO_MAX_BYTES,
  DRAFT_PHOTO_TYPES,
  type DraftSource,
  type DraftUpload as Upload,
  type PdfImportResult,
} from "@/lib/merchant/bulk";
import { isMessage } from "@/lib/api/problem";
import { sendJson } from "@/lib/merchant/client";

const MAX_PHOTOS_AT_ONCE = 50;

type Progress = { done: number; total: number } | null;

/**
 * Drafts from phone photos and catalog PDFs (#129, #109). Each file goes straight from the
 * browser to private storage through a short-lived presigned URL, then the API turns it into
 * a draft (a PDF into one draft per photo). Nothing is published: the seller finishes each
 * draft in the product form.
 */
export function DraftUpload() {
  const t = useTranslations("Merchant.import");
  const tm = useTranslations("Merchant");
  const router = useRouter();
  const id = useId();
  const [progress, setProgress] = useState<Progress>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const text = (k: string) => {
    if (isMessage(k)) return k;
    if (t.has(`errors.${k}` as "errors.fileRequired"))
      return t(`errors.${k}` as "errors.fileRequired");
    if (tm.has(`errors.${k}` as "errors.server")) return tm(`errors.${k}` as "errors.server");
    return tm("errors.server");
  };

  /** Presign, PUT, then confirm; returns an error key or null. */
  async function upload(file: File, kind: DraftSource): Promise<string | PdfImportResult | null> {
    const slot = await sendJson<Upload>("POST", "/api/merchant/drafts/uploads", {
      kind,
      contentType: file.type,
      sizeBytes: file.size,
    });
    if (!slot.ok) return slot.errors.form ?? "server";
    const put = await fetch(slot.data.url, {
      method: slot.data.method || "PUT",
      headers: slot.data.headers,
      body: file,
    }).catch(() => null);
    if (!put?.ok) return "upload";
    if (kind === "PDF") {
      const pdf = await sendJson<PdfImportResult>("POST", "/api/merchant/drafts/pdf", {
        key: slot.data.key,
      });
      return pdf.ok ? pdf.data : (pdf.errors.form ?? "server");
    }
    const draft = await sendJson("POST", "/api/merchant/drafts", { key: slot.data.key, kind });
    return draft.ok ? null : (draft.errors.form ?? "server");
  }

  async function onPhotos(e: ChangeEvent<HTMLInputElement>, kind: DraftSource) {
    const input = e.currentTarget;
    const files = [...(input.files ?? [])].slice(0, MAX_PHOTOS_AT_ONCE);
    input.value = "";
    if (files.length === 0) return;
    const failed: string[] = [];
    let ok = 0;
    setErrors([]);
    setNote(null);
    setProgress({ done: 0, total: files.length });
    // One at a time: a phone on mobile data keeps one upload going instead of fifty.
    for (const [i, file] of files.entries()) {
      let err: string | null = null;
      if (!(DRAFT_PHOTO_TYPES as readonly string[]).includes(file.type)) err = "photoType";
      else if (file.size > DRAFT_PHOTO_MAX_BYTES) err = "photoSize";
      else {
        const res = await upload(file, kind);
        err = typeof res === "string" ? res : null;
      }
      if (err) failed.push(`${file.name}: ${text(err)}`);
      else ok++;
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    setErrors(failed);
    setNote(t("photosDone", { count: ok }));
    if (ok > 0) router.refresh();
  }

  async function onPdf(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setErrors([]);
    setNote(null);
    if (file.type !== "application/pdf") return setErrors([text("pdfType")]);
    if (file.size > DRAFT_PDF_MAX_BYTES) return setErrors([text("pdfSize")]);
    setProgress({ done: 0, total: 1 });
    const res = await upload(file, "PDF");
    setProgress(null);
    if (typeof res === "string") return setErrors([text(res)]);
    if (res) {
      setNote(
        `${t("pdfDone", { count: res.drafts.length })}${res.limited ? ` ${t("pdfLimited")}` : ""}`,
      );
      if (res.drafts.length > 0) router.refresh();
    }
  }

  const busy = progress !== null;
  const pick =
    "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium outline-none hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:pointer-events-none has-disabled:opacity-50";

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{t("draftsIntro")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Label className={pick}>
          <Camera aria-hidden className="size-4" />
          {t("takePhoto")}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={busy}
            onChange={(e) => onPhotos(e, "CAMERA")}
            className="sr-only"
          />
        </Label>
        <Label className={pick}>
          <ImagePlus aria-hidden className="size-4" />
          {t("choosePhotos")}
          <input
            type="file"
            accept={DRAFT_PHOTO_TYPES.join(",")}
            multiple
            disabled={busy}
            onChange={(e) => onPhotos(e, "PHOTO")}
            className="sr-only"
          />
        </Label>
        <Label className={pick}>
          <FileText aria-hidden className="size-4" />
          {t("choosePdf")}
          <input
            type="file"
            accept="application/pdf"
            disabled={busy}
            onChange={onPdf}
            className="sr-only"
          />
        </Label>
      </div>
      <p id={`${id}-limits`} className="text-xs text-muted-foreground">
        {t("draftLimits")}
      </p>
      <div aria-live="polite" className="flex flex-col gap-2 text-sm">
        {progress && (
          <p className="flex items-center gap-2">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            {progress.total > 1
              ? t("uploadingMany", { done: progress.done, total: progress.total })
              : t("uploading")}
          </p>
        )}
        {note && <p className="rounded-md border p-3">{note}</p>}
      </div>
      {errors.length > 0 && (
        <ul
          role="alert"
          className="flex flex-col gap-1 rounded-md border border-destructive/40 p-3 text-sm text-destructive"
        >
          {errors.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
