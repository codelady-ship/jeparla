"use client";

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ImagePlus,
  Loader2,
  TriangleAlert,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type DragEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downscale, IMAGE_MAX_BYTES, IMAGE_TYPES, move } from "@/lib/merchant/images";
import { checkPhoto } from "@/lib/merchant/photo-quality";
import { MAX_IMAGES } from "@/lib/merchant/schemas";
import type { ProductImageInput } from "@/types/merchant";
import { cn } from "cn";
import { FitCompare, runFit, toDataUrl, type FitState } from "./image-fit";

/** The photo being fitted in the dialog. */
type Fitting = { id: string; name: string; original: string; fit: FitState };

/**
 * Drag and drop or pick photos (the phone camera opens through the picker).
 * Order matters: the first photo is the cover. Arrow buttons reorder, so it
 * works with a keyboard and on touch screens without drag gestures.
 */
export function ImageUpload({
  images,
  onChange,
  invalid,
  describedBy,
}: {
  images: ProductImageInput[];
  onChange: (images: ProductImageInput[]) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("Merchant.form.images");
  const id = useId();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const tf = useTranslations("Merchant.imageFit");
  const [fitting, setFitting] = useState<Fitting | null>(null);
  /** Number of the current fit run: a result of an older run (dialog closed or reopened) is dropped. */
  const fitRun = useRef(0);
  /**
   * Originals of fitted photos, by the fitted photo's id, so the seller can go back to them. The
   * fitted photo gets a new id: a photo already saved on the server is then replaced on save
   * (uploaded as a new one, the old one deleted) instead of being kept as it was.
   */
  const [originals, setOriginals] = useState<Record<string, ProductImageInput>>({});
  const max = IMAGE_MAX_BYTES / 1024 / 1024;

  /**
   * "Fit to design" (cut out, cream background, card frame): runs on this device. Offered only for
   * photos picked in this form (data: URLs): a saved photo is on the public R2 bucket, which does
   * not answer cross-origin GET, so it cannot be read back into the page.
   */
  async function fit(img: ProductImageInput, name: string) {
    const run = ++fitRun.current;
    setFitting({ id: img.id, name, original: img.url, fit: { state: "working" } });
    const source = await fetch(img.url)
      .then((r) => r.blob())
      .catch(() => null);
    const result: FitState = source ? await runFit(source) : { state: "failed", reason: "failed" };
    if (run !== fitRun.current) {
      // The dialog was closed (or opened again) while this photo was processed.
      if (result.state === "done") URL.revokeObjectURL(result.url);
      return;
    }
    setFitting((f) => (f ? { ...f, fit: result } : f));
  }

  function closeFit() {
    fitRun.current++;
    if (fitting?.fit.state === "done") URL.revokeObjectURL(fitting.fit.url);
    setFitting(null);
  }

  async function acceptFitted() {
    if (!fitting || fitting.fit.state !== "done") return;
    const url = await toDataUrl(fitting.fit.blob);
    const before = images.find((x) => x.id === fitting.id);
    if (!before) return closeFit();
    const fitted = { ...before, id: `fit-${Date.now().toString(36)}`, url };
    setOriginals((o) => ({ ...o, [fitted.id]: before }));
    onChange(images.map((x) => (x.id === before.id ? fitted : x)));
    setStatus(tf("used", { name: fitting.name }));
    closeFit();
  }

  function restore(id: string, name: string) {
    const original = originals[id];
    if (!original) return;
    onChange(images.map((x) => (x.id === id ? original : x)));
    setOriginals((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== id)));
    setStatus(tf("restored", { name }));
  }

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const next = [...images];
    const errs: string[] = [];
    const warn: string[] = [];
    setBusy(true);
    let added = 0;
    for (const f of Array.from(files)) {
      if (!(IMAGE_TYPES as readonly string[]).includes(f.type)) {
        errs.push(t("badType", { name: f.name }));
      } else if (f.size > IMAGE_MAX_BYTES) {
        errs.push(t("tooBig", { name: f.name, max }));
      } else if (next.length >= MAX_IMAGES) {
        errs.push(t("tooMany", { max: MAX_IMAGES }));
        break;
      } else {
        try {
          next.push({
            id: `${Date.now().toString(36)}-${next.length}`,
            url: await downscale(f),
            name: f.name.slice(0, 200),
          });
          added++;
          // Quality hints (#119) only warn: the seller may keep the photo.
          for (const w of await checkPhoto(f)) warn.push(t(`quality.${w}`, { name: f.name }));
        } catch {
          errs.push(t("failed", { name: f.name }));
        }
      }
    }
    setBusy(false);
    setProblems(errs);
    setHints(warn);
    setStatus(added ? t("added", { count: added }) : "");
    onChange(next);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    void add(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-3">
      <details className="rounded-lg border px-4 py-3 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-medium">
          <Camera aria-hidden className="size-4 text-gold-text" />
          {t("guide.title")}
        </summary>
        <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
          {(["light", "background", "angle", "focus", "scale"] as const).map((step) => (
            <li key={step}>{t(`guide.${step}`)}</li>
          ))}
        </ol>
      </details>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
          over ? "border-primary bg-muted" : invalid ? "border-destructive" : "border-border",
        )}
      >
        {busy ? (
          <Loader2 aria-hidden className="size-6 animate-spin text-gold-text" />
        ) : (
          <ImagePlus aria-hidden className="size-6 text-gold-text" />
        )}
        <span className="font-medium">{busy ? t("processing") : t("drop")}</span>
        <span className="text-xs text-muted-foreground">
          {t("rules", { max, count: MAX_IMAGES })}
        </span>
        <input
          id={id}
          type="file"
          multiple
          accept={IMAGE_TYPES.join(",")}
          className="sr-only"
          disabled={busy}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            void add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <div aria-live="polite" className="flex flex-col gap-1 text-sm">
        {status && <p className="sr-only">{status}</p>}
        {hints.length > 0 && (
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {hints.map((h) => (
              <li key={h} className="flex items-start gap-2">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-text" />
                {h}
              </li>
            ))}
          </ul>
        )}
        {problems.length > 0 && (
          <ul className="flex flex-col gap-1 text-destructive">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>

      {images.length > 0 && (
        <ol aria-label={t("list")} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => {
            const name = t("position", { n: i + 1 });
            return (
              <li key={img.id} className="flex flex-col gap-2 rounded-lg border p-2">
                <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
                  <Image
                    src={img.url}
                    alt={name}
                    fill
                    sizes="(min-width: 640px) 25vw, 50vw"
                    className="object-cover"
                    unoptimized
                  />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 rounded-sm bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                      {t("cover")}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => onChange(move(images, i, i - 1))}
                    disabled={i === 0}
                    aria-label={t("moveBack", { name })}
                    className="inline-flex size-9 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40"
                  >
                    <ArrowLeft aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(move(images, i, i + 1))}
                    disabled={i === images.length - 1}
                    aria-label={t("moveForward", { name })}
                    className="inline-flex size-9 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40"
                  >
                    <ArrowRight aria-hidden className="size-4" />
                  </button>
                  {originals[img.id] ? (
                    <button
                      type="button"
                      onClick={() => restore(img.id, name)}
                      aria-label={tf("restore", { name })}
                      title={tf("restore", { name })}
                      className="inline-flex size-9 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <Undo2 aria-hidden className="size-4" />
                    </button>
                  ) : img.url.startsWith("data:") ? (
                    <button
                      type="button"
                      onClick={() => void fit(img, name)}
                      disabled={fitting !== null}
                      aria-label={tf("actionFor", { name })}
                      title={tf("actionFor", { name })}
                      className="inline-flex size-9 items-center justify-center rounded-md text-gold-text outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40"
                    >
                      <Wand2 aria-hidden className="size-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onChange(images.filter((x) => x.id !== img.id))}
                    aria-label={t("remove", { name })}
                    className="inline-flex size-9 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Dialog open={fitting !== null} onOpenChange={(open) => !open && closeFit()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{tf("title", { name: fitting?.name ?? "" })}</DialogTitle>
            <DialogDescription>{tf("note")}</DialogDescription>
          </DialogHeader>
          {fitting && (
            <FitCompare
              name={fitting.name}
              original={fitting.original}
              fit={fitting.fit}
              onUse={() => void acceptFitted()}
              onKeep={closeFit}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
