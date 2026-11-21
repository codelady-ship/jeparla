"use client";

import { Camera, Crop, ImageOff, Loader2, Search, SlidersHorizontal, Upload } from "lucide-react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/money";
import {
  cropPhoto,
  filterEntries,
  FULL_CROP,
  IMAGE_ACCEPT,
  IMAGE_EDIT_SIDE,
  IMAGE_MAX_BYTES,
  preparePhoto,
  type CropRect,
  type PhotoFilters,
} from "@/lib/search/image";
import type {
  ImageSearchError,
  ImageSearchPanelStatus,
  ImageSearchResult,
  ProductSummary,
} from "@/types/api";
import { cn } from "cn";
import { PhotoCrop } from "./photo-crop";

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
  /** Bijouterie (#128) is marked apart from precious jewelry in the results. */
  fashionBadge: string;
  crop: { title: string; hint: string; frame: string; search: string; whole: string };
  filters: {
    title: string;
    category: string;
    allCategories: string;
    metal: string;
    any: string;
    fineness: string;
    price: string;
    min: string;
    max: string;
    store: string;
    city: string;
    anyCity: string;
    apply: string;
    clear: string;
    empty: string;
  };
  metals: Record<string, string>;
  errors: Record<ImageSearchError | "generic", string>;
};

type Options = Pick<ImageSearchPanelStatus, "categories" | "finenesses">;

type State =
  | { status: "checking" }
  | { status: "off" }
  | { status: "ready" }
  | { status: "framing"; edit: Blob; url: string }
  | { status: "searching"; preview: string; photo: Blob }
  | { status: "done"; preview: string; photo: Blob; products: ProductSummary[] }
  | { status: "error"; preview?: string; photo?: Blob; error: ImageSearchError | "generic" };

const METALS = ["GOLD", "SILVER", "PLATINUM"] as const;

const field =
  "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * Search by photo (#163), loaded only when the camera button is pressed. The
 * buyer frames the item, then the framed part is scaled down and re-encoded in
 * the browser (EXIF dropped), sent and kept nowhere but this panel's memory (a
 * filter change sends it again). Results are an ordered list: no invented
 * similarity score. Without a model on the server it says so instead of showing samples.
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
  const [options, setOptions] = useState<Options>({});
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [filters, setFilters] = useState<PhotoFilters>({});
  /** Stores and cities of the unfiltered answer: the choices of those two filters. */
  const [base, setBase] = useState<ProductSummary[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const cropHintId = useId();
  const preview = "preview" in state ? state.preview : undefined;
  const editUrl = state.status === "framing" ? state.url : undefined;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/search/image", { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ImageSearchPanelStatus>) : null))
      .then((s) => {
        setOptions({ categories: s?.categories, finenesses: s?.finenesses });
        setState(s?.configured ? { status: "ready" } : { status: "off" });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ status: "off" });
      });
    return () => ctrl.abort();
  }, []);

  // Local object URLs: freed when they change or the panel closes.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  useEffect(() => () => void (editUrl && URL.revokeObjectURL(editUrl)), [editUrl]);

  const stores = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of base) seen.set(p.store.slug, p.store.name);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1], locale));
  }, [base, locale]);
  const cities = useMemo(
    () => [...new Set(base.map((p) => p.store.city))].sort((a, b) => a.localeCompare(b, locale)),
    [base, locale],
  );

  /** Step 1: the picked file becomes an upright JPEG copy to frame. */
  async function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > IMAGE_MAX_BYTES * 4) {
      setState({ status: "error", error: "search.image_size" });
      return;
    }
    const edit = await preparePhoto(file, IMAGE_EDIT_SIDE);
    if (!edit) {
      setState({ status: "error", error: "search.image_type" });
      return;
    }
    setCrop(FULL_CROP);
    setFilters({});
    setBase([]);
    setState({ status: "framing", edit, url: URL.createObjectURL(edit) });
  }

  /** Step 2: the framed part is cut out and searched. */
  async function searchFramed() {
    if (state.status !== "framing") return;
    const photo = await cropPhoto(state.edit, crop);
    if (!photo) {
      setState({ status: "error", error: "search.image_type" });
      return;
    }
    await run(photo, {}, URL.createObjectURL(photo));
  }

  /** Sends the photo with the filters; the first answer without filters gives the store and city choices. */
  async function run(photo: Blob, applied: PhotoFilters, url: string) {
    setState({ status: "searching", preview: url, photo });
    const body = new FormData();
    body.append("image", photo, "photo.jpg");
    for (const [key, value] of filterEntries(applied)) body.append(key, value);
    try {
      const res = await fetch("/api/search/image", { method: "POST", body });
      const result = (await res.json()) as ImageSearchResult;
      if (result.ok && filterEntries(applied).length === 0) setBase(result.products);
      setState(
        result.ok
          ? { status: "done", preview: url, photo, products: result.products }
          : { status: "error", preview: url, photo, error: result.error },
      );
    } catch {
      setState({ status: "error", preview: url, photo, error: "generic" });
    }
  }

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    if ((state.status === "done" || state.status === "error") && state.photo && state.preview) {
      void run(state.photo, filters, state.preview);
    }
  }

  function clearFilters() {
    setFilters({});
    if ((state.status === "done" || state.status === "error") && state.photo && state.preview) {
      void run(state.photo, {}, state.preview);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void pick(e.dataTransfer.files[0]);
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
  const searched = (state.status === "done" || state.status === "error") && !!state.photo;
  const set = (key: keyof PhotoFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value || undefined }));

  return (
    <div className="flex flex-col gap-4 p-4">
      {state.status === "framing" ? (
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Crop aria-hidden className="size-4 text-gold-text" />
            {labels.crop.title}
          </h3>
          <p id={cropHintId} className="text-sm text-muted-foreground">
            {labels.crop.hint}
          </p>
          <PhotoCrop
            src={state.url}
            crop={crop}
            onChange={setCrop}
            label={labels.crop.frame}
            hintId={cropHintId}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => void searchFramed()}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              <Search aria-hidden className="size-4" />
              {labels.crop.search}
            </button>
            <button
              type="button"
              onClick={() => setCrop(FULL_CROP)}
              className="inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
            >
              {labels.crop.whole}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium"
            >
              <Upload aria-hidden className="size-4" />
              {labels.pick}
            </button>
          </div>
        </div>
      ) : (
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
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {searched && (
        <details className="rounded-lg border" open={filterEntries(filters).length > 0}>
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-medium">
            <SlidersHorizontal aria-hidden className="size-4 text-gold-text" />
            {labels.filters.title}
          </summary>
          <form onSubmit={applyFilters} className="grid grid-cols-2 gap-3 border-t p-3">
            <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {labels.filters.category}
              <select
                className={field}
                value={filters.category ?? ""}
                onChange={(e) => set("category", e.target.value)}
              >
                <option value="">{labels.filters.allCategories}</option>
                {(options.categories ?? []).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name[locale] || c.slug}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {labels.filters.metal}
              <select
                className={field}
                value={filters.metal ?? ""}
                onChange={(e) => set("metal", e.target.value)}
              >
                <option value="">{labels.filters.any}</option>
                {METALS.map((m) => (
                  <option key={m} value={m}>
                    {labels.metals[m] ?? m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {labels.filters.fineness}
              <select
                className={field}
                value={filters.fineness ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    fineness: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              >
                <option value="">{labels.filters.any}</option>
                {(options.finenesses ?? []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="col-span-2 grid grid-cols-2 gap-3">
              <legend className="mb-1 text-xs text-muted-foreground">{labels.filters.price}</legend>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {labels.filters.min}
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className={field}
                  value={filters.minPrice ?? ""}
                  onChange={(e) => set("minPrice", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {labels.filters.max}
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className={field}
                  value={filters.maxPrice ?? ""}
                  onChange={(e) => set("maxPrice", e.target.value)}
                />
              </label>
            </fieldset>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {labels.filters.store}
              <select
                className={field}
                value={filters.store ?? ""}
                onChange={(e) => set("store", e.target.value)}
              >
                <option value="">{labels.filters.any}</option>
                {stores.map(([slug, name]) => (
                  <option key={slug} value={slug}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {labels.filters.city}
              <select
                className={field}
                value={filters.city ?? ""}
                onChange={(e) => set("city", e.target.value)}
              >
                <option value="">{labels.filters.anyCity}</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="col-span-2 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {labels.filters.apply}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={clearFilters}
                className="inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium disabled:opacity-60"
              >
                {labels.filters.clear}
              </button>
            </div>
          </form>
        </details>
      )}

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
          <p className="text-sm text-muted-foreground">
            {filterEntries(filters).length > 0 ? labels.filters.empty : labels.empty}
          </p>
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
                      {p.materialKind === "FASHION" && (
                        <span className="text-xs text-muted-foreground">{labels.fashionBadge}</span>
                      )}
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
