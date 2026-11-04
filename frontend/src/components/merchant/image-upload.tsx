"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState, type DragEvent } from "react";
import { downscale, IMAGE_MAX_BYTES, IMAGE_TYPES, move } from "@/lib/merchant/images";
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
  const [status, setStatus] = useState("");
  const max = IMAGE_MAX_BYTES / 1024 / 1024;

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const next = [...images];
    const errs: string[] = [];
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
        } catch {
          errs.push(t("failed", { name: f.name }));
        }
      }
    }
    setBusy(false);
    setProblems(errs);
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
