"use client";

import { Camera, ImageOff, Loader2, Upload } from "lucide-react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/money";
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES, preparePhoto } from "@/lib/search/image";
import type {
  ImageSearchError,
  ImageSearchResult,
  ImageSearchStatus,
  ProductSummary,
} from "@/types/api";
import { cn } from "cn";

export type PhotoSearchLabels = {
  title: string;
  hint: string;
  pick: string;
  camera: string;
  drop: string;
  searching: string;
  results: string;
  empty: string;
  notConfigured: string;
  aiBadge: string;
  errors: Record<ImageSearchError | "generic", string>;
};

type State =
  | { status: "checking" }
  | { status: "off" }
  | { status: "ready" }
  | { status: "searching"; preview: string }
  | { status: "done"; preview: string; products: ProductSummary[] }
  | { status: "error"; preview?: string; error: ImageSearchError | "generic" };

/**
 * Search by photo (#163), loaded only when the camera button is pressed. The
 * photo is scaled down and re-encoded in the browser (EXIF dropped), sent once
 * and kept nowhere. Results are an ordered list: no invented similarity score.
 * Without a model on the server it says so instead of showing samples.
 */
export default function ImageSearchPanel({
  labels,
  onNavigate,
}: {
  labels: PhotoSearchLabels;
  onNavigate: () => void;
}) {
  const locale = useLocale();
  const [state, setState] = useState<State>({ status: "checking" });
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const preview = "preview" in state ? state.preview : undefined;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/search/image", { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ImageSearchStatus>) : null))
      .then((s) => setState(s?.configured ? { status: "ready" } : { status: "off" }))
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ status: "off" });
      });
    return () => ctrl.abort();
  }, []);

  // The preview is a local object URL: freed when it changes or the panel closes.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function search(file: File | undefined) {
    if (!file) return;
    if (file.size > IMAGE_MAX_BYTES * 4) {
      setState({ status: "error", error: "search.image_size" });
      return;
    }
    const photo = await preparePhoto(file);
    if (!photo) {
      setState({ status: "error", error: "search.image_type" });
      return;
    }
    const url = URL.createObjectURL(photo);
    setState({ status: "searching", preview: url });
    const body = new FormData();
    body.append("image", photo, "photo.jpg");
    try {
      const res = await fetch("/api/search/image", { method: "POST", body });
      const result = (await res.json()) as ImageSearchResult;
      setState(
        result.ok
          ? { status: "done", preview: url, products: result.products }
          : { status: "error", preview: url, error: result.error },
      );
    } catch {
      setState({ status: "error", preview: url, error: "generic" });
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void search(e.dataTransfer.files[0]);
  }

  if (state.status === "checking") {
    return (
      <div className="flex items-center justify-center p-8" role="status">
        <Loader2 aria-hidden className="size-5 animate-spin text-muted-foreground" />
        <span className="sr-only">{labels.searching}</span>
      </div>
    );
  }

  if (state.status === "off") {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <ImageOff aria-hidden className="size-6 text-gold-text" />
        <p className="font-medium">{labels.title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{labels.notConfigured}</p>
      </div>
    );
  }

  const busy = state.status === "searching";
  return (
    <div className="flex flex-col gap-4 p-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border border-dashed p-5 text-center",
          dragging && "border-gold bg-muted",
        )}
      >
        {preview ? (
          <span className="relative size-24 overflow-hidden rounded-md bg-muted">
            <Image src={preview} alt="" fill sizes="96px" className="object-cover" unoptimized />
          </span>
        ) : (
          <Camera aria-hidden className="size-6 text-gold-text" />
        )}
        <p id={hintId} className="max-w-sm text-sm text-muted-foreground">
          {labels.hint}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            aria-describedby={hintId}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            <Upload aria-hidden className="size-4" />
            {labels.pick}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium disabled:opacity-60 sm:hidden"
          >
            <Camera aria-hidden className="size-4" />
            {labels.camera}
          </button>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">{labels.drop}</p>
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void search(e.target.files?.[0])}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void search(e.target.files?.[0])}
        />
      </div>

      <div aria-live="polite" className="flex flex-col gap-2">
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            {labels.searching}
          </p>
        )}
        {state.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {labels.errors[state.error]}
          </p>
        )}
        {state.status === "done" && state.products.length === 0 && (
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        )}
        {state.status === "done" && state.products.length > 0 && (
          <>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">
              {labels.results}
            </h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {state.products.map((p) => {
                const image = p.images[0];
                return (
                  <li key={p.id}>
                    <Link
                      href={`/products/${p.slug}`}
                      onClick={onNavigate}
                      className="flex flex-col gap-1 rounded-md p-1 hover:bg-muted"
                    >
                      <span className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
                        {image && (
                          <Image
                            src={image.url}
                            alt={image.alt[locale] || p.name[locale]}
                            fill
                            sizes="(min-width: 640px) 180px, 45vw"
                            className="object-cover"
                          />
                        )}
                        {image?.aiGenerated && (
                          <span className="absolute top-1 left-1 rounded-sm bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                            {labels.aiBadge}
                          </span>
                        )}
                      </span>
                      <span className="truncate text-sm">{p.name[locale]}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatPrice(p.priceFrom.amount, locale)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
