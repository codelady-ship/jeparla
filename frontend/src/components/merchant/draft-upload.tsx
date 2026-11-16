"use client";

import {
  Camera,
  Crop,
  FileText,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload as UploadIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
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
import {
  applyEdit,
  CROP_PRESETS,
  isNoEdit,
  NO_EDIT,
  turn,
  type CropPreset,
  type PhotoEdit,
} from "@/lib/merchant/photo-edit";
import { isMessage } from "@/lib/api/problem";
import { sendJson } from "@/lib/merchant/client";

const MAX_PHOTOS_AT_ONCE = 50;
/** Longest side of a queue preview; small so fifty photos stay light in memory. */
const PREVIEW_SIDE = 320;

type Progress = { done: number; total: number } | null;

/** A photo waiting in the preview queue; a failed one keeps its reason until retried. */
type Queued = {
  key: number;
  file: File;
  kind: DraftSource;
  edit: PhotoEdit;
  state: "ready" | "uploading" | "failed";
  error: string | null;
};

const CROP_LABEL: Record<CropPreset, "cropOriginal" | "cropSquare" | "cropPortrait"> = {
  original: "cropOriginal",
  square: "cropSquare",
  portrait: "cropPortrait",
};

/**
 * Drafts from phone photos and catalog PDFs (#129, #109). Photos first land in a preview queue
 * where the seller can rotate and crop them (canvas, in the browser); then each file goes
 * straight from the browser to private storage through a short-lived presigned URL, and the
 * API turns it into a draft (a PDF into one draft per photo). A photo that fails stays in the
 * queue with its reason and can be sent again on its own. Nothing is published.
 */
export function DraftUpload() {
  const t = useTranslations("Merchant.import");
  const tm = useTranslations("Merchant");
  const router = useRouter();
  const id = useId();
  const [queue, setQueue] = useState<Queued[]>([]);
  const [progress, setProgress] = useState<Progress>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const nextKey = useRef(1);

  const text = (k: string) => {
    if (isMessage(k)) return k;
    if (t.has(`errors.${k}` as "errors.fileRequired"))
      return t(`errors.${k}` as "errors.fileRequired");
    if (tm.has(`errors.${k}` as "errors.server")) return tm(`errors.${k}` as "errors.server");
    return tm("errors.server");
  };

  /** Presign, PUT, then confirm; returns an error key, the PDF result, or null. */
  async function upload(file: Blob, kind: DraftSource): Promise<string | PdfImportResult | null> {
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

  /** Edits (if any) and uploads one queued photo; returns an error key or null. */
  async function sendPhoto(item: Queued): Promise<string | null> {
    const body = isNoEdit(item.edit) ? item.file : await applyEdit(item.file, item.edit);
    if (!body) return "photoRead";
    if (body.size > DRAFT_PHOTO_MAX_BYTES) return "photoSize";
    const res = await upload(body, item.kind);
    return typeof res === "string" ? res : null;
  }

  function onPhotos(e: ChangeEvent<HTMLInputElement>, kind: DraftSource) {
    const input = e.currentTarget;
    const picked = [...(input.files ?? [])];
    input.value = "";
    if (picked.length === 0) return;
    const room = MAX_PHOTOS_AT_ONCE - queue.length;
    const rejected: string[] = [];
    const added: Queued[] = [];
    for (const file of picked) {
      if (!(DRAFT_PHOTO_TYPES as readonly string[]).includes(file.type)) {
        rejected.push(`${file.name}: ${text("photoType")}`);
      } else if (added.length < room) {
        added.push({
          key: nextKey.current++,
          file,
          kind,
          edit: NO_EDIT,
          state: "ready",
          error: null,
        });
      }
    }
    const valid = picked.length - rejected.length;
    if (valid > added.length) rejected.push(t("queueLimit", { max: MAX_PHOTOS_AT_ONCE }));
    setErrors(rejected);
    setNote(null);
    setQueue((q) => [...q, ...added]);
  }

  const patch = (key: number, fn: (q: Queued) => Queued) =>
    setQueue((list) => list.map((q) => (q.key === key ? fn(q) : q)));

  /** Uploads the given photos one at a time; sent ones leave the queue, failed ones stay. */
  async function sendAll(keys: number[]) {
    const items = queue.filter((q) => keys.includes(q.key) && q.state !== "uploading");
    if (items.length === 0) return;
    setErrors([]);
    setNote(null);
    setProgress({ done: 0, total: items.length });
    let ok = 0;
    // One at a time: a phone on mobile data keeps one upload going instead of fifty.
    for (const [i, item] of items.entries()) {
      patch(item.key, (q) => ({ ...q, state: "uploading", error: null }));
      const err = await sendPhoto(item);
      if (err) patch(item.key, (q) => ({ ...q, state: "failed", error: err }));
      else {
        ok++;
        setQueue((list) => list.filter((q) => q.key !== item.key));
      }
      setProgress({ done: i + 1, total: items.length });
    }
    setProgress(null);
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
  const failed = queue.filter((q) => q.state === "failed");
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

      {queue.length > 0 && (
        <section aria-labelledby={`${id}-queue`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={`${id}-queue`} className="text-sm font-medium">
              {t("queueTitle", { count: queue.length })}
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setQueue([]);
                  setErrors([]);
                }}
              >
                <Trash2 aria-hidden />
                {t("queueClear")}
              </Button>
              {failed.length > 0 && failed.length < queue.length && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => sendAll(failed.map((q) => q.key))}
                >
                  <RefreshCw aria-hidden />
                  {t("retryFailed", { count: failed.length })}
                </Button>
              )}
              <Button
                variant="gold"
                size="sm"
                disabled={busy}
                onClick={() => sendAll(queue.map((q) => q.key))}
              >
                <UploadIcon aria-hidden />
                {t("uploadAll", { count: queue.length })}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("queueHint")}</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {queue.map((item) => (
              <QueueItem
                key={item.key}
                item={item}
                busy={busy}
                errorText={item.error ? text(item.error) : null}
                onEdit={(edit) => patch(item.key, (q) => ({ ...q, edit }))}
                onRemove={() => setQueue((list) => list.filter((q) => q.key !== item.key))}
                onRetry={() => sendAll([item.key])}
              />
            ))}
          </ul>
        </section>
      )}

      <div aria-live="polite" className="flex flex-col gap-2 text-sm">
        {progress && (
          <p className="flex items-center gap-2">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            {progress.total > 1
              ? t("uploadingMany", { done: progress.done, total: progress.total })
              : t("uploading")}
          </p>
        )}
        {note && (
          <p className="rounded-md border p-3">
            {note}
            {!busy && failed.length > 0 && ` ${t("failedStay", { count: failed.length })}`}
          </p>
        )}
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

function QueueItem({
  item,
  busy,
  errorText,
  onEdit,
  onRemove,
  onRetry,
}: {
  item: Queued;
  busy: boolean;
  errorText: string | null;
  onEdit: (e: PhotoEdit) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("Merchant.import");
  const [preview, setPreview] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const { file, edit } = item;

  // The preview is drawn with the same canvas code as the upload, so it shows exactly what
  // will be sent.
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    applyEdit(file, edit, PREVIEW_SIDE, 0.7).then((blob) => {
      if (!live) return;
      setUnreadable(!blob);
      if (blob) {
        url = URL.createObjectURL(blob);
        setPreview(url);
      }
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, edit]);

  const locked = busy || item.state === "uploading";
  const name = file.name;

  return (
    <li
      className="flex flex-col gap-2 rounded-lg border p-2 data-[failed=true]:border-destructive/50"
      data-failed={item.state === "failed"}
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-muted">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a site image
          <img
            src={preview}
            alt={t("previewAlt", { name })}
            className="max-h-full max-w-full object-contain"
          />
        ) : unreadable ? (
          <span className="p-2 text-center text-xs text-muted-foreground">
            {t("errors.photoRead")}
          </span>
        ) : (
          <Loader2 aria-hidden className="size-5 animate-spin text-muted-foreground" />
        )}
      </div>
      <p className="truncate text-xs" title={name}>
        {name}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={locked}
          aria-label={t("rotateLeft", { name })}
          title={t("rotateLeft", { name })}
          onClick={() => onEdit(turn(edit, -1))}
        >
          <RotateCcw aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={locked}
          aria-label={t("rotateRight", { name })}
          title={t("rotateRight", { name })}
          onClick={() => onEdit(turn(edit, 1))}
        >
          <RotateCw aria-hidden />
        </Button>
        <div
          role="group"
          aria-label={t("cropLabel", { name })}
          className="ml-auto flex items-center gap-1"
        >
          <Crop aria-hidden className="size-3.5 text-muted-foreground" />
          {CROP_PRESETS.map((c) => (
            <Button
              key={c}
              variant={edit.crop === c ? "secondary" : "ghost"}
              size="xs"
              disabled={locked}
              aria-pressed={edit.crop === c}
              onClick={() => onEdit({ ...edit, crop: c })}
            >
              {t(CROP_LABEL[c])}
            </Button>
          ))}
        </div>
      </div>
      {item.state === "uploading" && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 aria-hidden className="size-3.5 animate-spin" />
          {t("uploading")}
        </p>
      )}
      {item.state === "failed" && errorText && (
        <p className="text-xs text-destructive">{errorText}</p>
      )}
      <div className="flex flex-wrap gap-1">
        {item.state === "failed" && (
          <Button variant="outline" size="sm" disabled={locked} onClick={onRetry}>
            <RefreshCw aria-hidden />
            {t("retry")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={locked}
          aria-label={t("removeFromQueue", { name })}
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
          {t("remove")}
        </Button>
      </div>
    </li>
  );
}
