"use client";

import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  ViewTransition,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "cn";

export type GalleryImage = { url: string; alt: string; aiGenerated: boolean };

type Labels = {
  prev: string;
  next: string;
  zoom: string;
  close: string;
  ai: string;
  /** Raw template with {n} and {total}, filled in here (functions cannot cross to the client). */
  position: string;
};

const fill = (tpl: string, n: number, total: number) =>
  tpl.replace("{n}", String(n)).replace("{total}", String(total));

const svg = (url: string) => url.endsWith(".svg");

/** The first photo uses the same sizes in both layouts, so the browser fetches it once. */
const FIRST_SIZES = "(min-width: 1024px) 50vw, 100vw";

const roundButton =
  "touch-target inline-flex size-10 items-center justify-center rounded-full bg-background/90 shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Product photos (#173).
 * - Phones and tablets: full-width swipe carousel with a "1 / 5" counter and dots.
 * - Desktop: a large grid (first photo full width, the rest in two columns); a
 *   magnifier follows the mouse (2x, transform only) and a click opens the full view.
 * - Full view: one photo at a time, arrows and the keyboard to move, pinch-zoom on
 *   touch, Escape closes and focus returns. Large files load only when it opens.
 * The first photo shares its view-transition name with the product card (morph).
 */
export function Gallery({
  productId,
  images,
  labels,
}: {
  productId: number;
  images: GalleryImage[];
  labels: Labels;
}) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const startX = useRef<number | null>(null);
  const total = images.length;
  // The hidden shots (opacity 0, same box) load after the page, not with the first
  // photo (#160); choosing a shot before that loads it at once.
  const [rest, setRest] = useState(false);
  const show = (i: number) => {
    setRest(true);
    setIndex(i);
  };
  const go = (i: number) => show((i + total) % total);
  const open = (i: number) => {
    show(i);
    setZoom(true);
  };

  useEffect(() => {
    const load = () => setRest(true);
    if (document.readyState === "complete") return load();
    window.addEventListener("load", load, { once: true });
    return () => window.removeEventListener("load", load);
  }, []);

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === "touch") startX.current = e.clientX;
  }
  function onPointerUp(e: PointerEvent) {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
  }
  function onKeyDown(e: KeyboardEvent) {
    if (total < 2) return;
    if (e.key === "ArrowRight") go(index + 1);
    if (e.key === "ArrowLeft") go(index - 1);
  }

  if (total === 0) return null;
  const current = images[index];
  const position = fill(labels.position, index + 1, total);

  const aiBadge = (img: GalleryImage) =>
    img.aiGenerated && (
      <Badge variant="secondary" className="absolute top-3 left-3 z-10">
        {labels.ai}
      </Badge>
    );

  const morph = (node: ReactNode) => (
    <ViewTransition name={`product-${productId}`} share="morph" default="none">
      {node}
    </ViewTransition>
  );

  return (
    <div>
      {/* Phones and tablets: swipe carousel. */}
      <div
        className="relative aspect-[4/5] touch-pan-y overflow-hidden rounded-lg bg-muted select-none lg:hidden"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        aria-roledescription="carousel"
      >
        {images.map((img, i) => {
          const image = (i === 0 || rest) && (
            <Image
              src={img.url}
              alt={img.alt}
              fill
              sizes={i === 0 ? FIRST_SIZES : "100vw"}
              preload={i === 0}
              fetchPriority={i === 0 ? "high" : undefined}
              unoptimized={svg(img.url)}
              className="object-cover"
            />
          );
          return (
            <div
              key={img.url + i}
              aria-hidden={i !== index}
              className={cn(
                "absolute inset-0 transition-opacity duration-(--duration-slow) ease-(--ease-luxe) motion-reduce:transition-none",
                i === index ? "opacity-100" : "opacity-0",
              )}
            >
              {i === 0 ? morph(image) : image}
            </div>
          );
        })}
        {aiBadge(current)}
        <button
          type="button"
          onClick={() => setZoom(true)}
          aria-label={labels.zoom}
          className={cn(roundButton, "absolute right-3 bottom-3")}
        >
          <Expand aria-hidden className="size-4" />
        </button>
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={labels.prev}
              className={cn(
                roundButton,
                "absolute top-1/2 left-3 hidden -translate-y-1/2 sm:inline-flex",
              )}
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={labels.next}
              className={cn(
                roundButton,
                "absolute top-1/2 right-3 hidden -translate-y-1/2 sm:inline-flex",
              )}
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
            {/* Visible counter and dots; the live region below speaks the position. */}
            <span
              aria-hidden
              className="absolute bottom-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium tabular-nums shadow-sm"
            >
              {index + 1} / {total}
            </span>
            <span aria-hidden className="absolute inset-x-0 bottom-5 flex justify-center gap-1.5">
              {images.map((img, i) => (
                <span
                  key={img.url + i}
                  className={cn(
                    "size-1.5 rounded-full bg-background shadow-sm transition-opacity duration-(--duration-base) motion-reduce:transition-none",
                    i === index ? "opacity-100" : "opacity-50",
                  )}
                />
              ))}
            </span>
          </>
        )}
        <p className="sr-only" aria-live="polite">
          {position}
        </p>
      </div>

      {/* Desktop: large grid with a magnifier; a click opens the full view. */}
      <ul className="hidden grid-cols-2 gap-3 lg:grid">
        {images.map((img, i) => {
          const image = (
            <Image
              src={img.url}
              alt={img.alt}
              fill
              sizes={i === 0 ? FIRST_SIZES : "25vw"}
              fetchPriority={i === 0 ? "high" : undefined}
              unoptimized={svg(img.url)}
              className="gallery-lens object-cover"
            />
          );
          return (
            <li key={img.url + i} className={cn(i === 0 && "col-span-2")}>
              <button
                type="button"
                onClick={() => open(i)}
                onPointerMove={(e) => {
                  if (e.pointerType !== "mouse") return;
                  const r = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty(
                    "--lens-x",
                    `${((e.clientX - r.left) / r.width) * 100}%`,
                  );
                  e.currentTarget.style.setProperty(
                    "--lens-y",
                    `${((e.clientY - r.top) / r.height) * 100}%`,
                  );
                }}
                aria-label={`${labels.zoom}: ${fill(labels.position, i + 1, total)}`}
                className="group/lens relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {i === 0 ? morph(image) : image}
                {aiBadge(img)}
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent
          closeLabel={labels.close}
          className="max-w-[min(92vw,56rem)] p-2 sm:max-w-[min(92vw,56rem)]"
          onKeyDown={onKeyDown}
        >
          <DialogTitle className="sr-only">{current.alt}</DialogTitle>
          {/* Pinch-zoom stays with the browser on touch screens. */}
          <div className="relative aspect-[4/5] max-h-[85vh] w-full touch-pinch-zoom overflow-auto">
            <Image
              src={current.url}
              alt={current.alt}
              fill
              sizes="92vw"
              unoptimized={svg(current.url)}
              className="object-contain"
            />
            {aiBadge(current)}
          </div>
          {total > 1 && (
            <div className="flex items-center justify-between gap-2 px-1 pb-1">
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label={labels.prev}
                className={roundButton}
              >
                <ChevronLeft aria-hidden className="size-5" />
              </button>
              <p className="text-sm tabular-nums" aria-live="polite">
                {position}
              </p>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label={labels.next}
                className={roundButton}
              >
                <ChevronRight aria-hidden className="size-5" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
