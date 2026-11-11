"use client";

import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, ViewTransition, type PointerEvent } from "react";
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

/**
 * Product images: cross-fade between shots, swipe on touch, thumbnails, zoom dialog.
 * The first image shares its view-transition name with the product card (morph).
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

  if (total === 0) return null;
  const current = images[index];

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative aspect-[4/5] touch-pan-y overflow-hidden rounded-lg bg-muted select-none"
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
              sizes="(min-width: 1024px) 50vw, 100vw"
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
              {i === 0 ? (
                <ViewTransition name={`product-${productId}`} share="morph" default="none">
                  {image}
                </ViewTransition>
              ) : (
                image
              )}
            </div>
          );
        })}
        {current.aiGenerated && (
          <Badge variant="secondary" className="absolute top-3 left-3">
            {labels.ai}
          </Badge>
        )}
        <button
          type="button"
          onClick={() => setZoom(true)}
          aria-label={labels.zoom}
          className="touch-target absolute right-3 bottom-3 inline-flex size-10 items-center justify-center rounded-full bg-background/90 shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Expand aria-hidden className="size-4" />
        </button>
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={labels.prev}
              className="touch-target absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:inline-flex"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={labels.next}
              className="touch-target absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:inline-flex"
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
          </>
        )}
        <p className="sr-only" aria-live="polite">
          {fill(labels.position, index + 1, total)}
        </p>
      </div>

      {total > 1 && (
        <ul className="flex gap-2">
          {images.map((img, i) => (
            <li key={img.url + i}>
              <button
                type="button"
                onClick={() => show(i)}
                aria-current={i === index}
                aria-label={fill(labels.position, i + 1, total)}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-md border-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  i === index ? "border-primary" : "border-transparent",
                )}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="64px"
                  unoptimized={svg(img.url)}
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent
          closeLabel={labels.close}
          className="max-w-[min(92vw,56rem)] p-2 sm:max-w-[min(92vw,56rem)]"
        >
          <DialogTitle className="sr-only">{current.alt}</DialogTitle>
          <div className="relative aspect-[4/5] max-h-[85vh] w-full overflow-auto">
            <Image
              src={current.url}
              alt={current.alt}
              fill
              sizes="92vw"
              unoptimized={svg(current.url)}
              className="object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
