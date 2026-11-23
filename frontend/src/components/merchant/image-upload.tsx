"use client";

import { ArrowLeft, ArrowRight, Camera, ImagePlus, Loader2, TriangleAlert, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState, type DragEvent } from "react";
import { downscale, IMAGE_MAX_BYTES, IMAGE_TYPES, move } from "@/lib/merchant/images";
import { checkPhoto } from "@/lib/merchant/photo-quality";
import { MAX_IMAGES } from "@/lib/merchant/schemas";
import type { ProductImageInput } from "@/types/merchant";
import { cn } from "cn";

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
  maxCount = MAX_IMAGES,
}: {
  images: ProductImageInput[];
  onChange: (images: ProductImageInput[]) => void;
  invalid?: boolean;
  describedBy?: string;
  /** Fewer photos where they wait in a browser draft (the /sell wizard, #317). */
  maxCount?: number;
}) {
  const t = useTranslations("Merchant.form.images");
  const id = useId();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const max = IMAGE_MAX_BYTES / 1024 / 1024;

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
      } else if (next.length >= maxCount) {
        errs.push(t("tooMany", { max: maxCount }));
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
          {t("rules", { max, count: maxCount })}
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
    </div>
  );
}
