"use client";

import { ChevronLeft, ChevronRight, Expand, UserRound } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "cn";
import { VideoSlide, type GalleryVideo, type VideoLabels } from "./video-slide";

/** `badge` names a hallmark or label shot (#106); otherwise AI images carry the AI label. */
export type GalleryImage = {
  url: string;
  alt: string;
  aiGenerated: boolean;
  badge?: string;
  /** The product on an AI model (an approved try-on, V68): the only target of "Modeldə bax". */
  onModel?: boolean;
};

type Labels = {
  prev: string;
  next: string;
  zoom: string;
  close: string;
  ai: string;
  /** Raw template with {n} and {total}, filled in here (functions cannot cross to the client). */
  position: string;
  /** Only read when the product has a video (#117). */
  video?: VideoLabels;
  /** "On a model" jump (#315): only read when the photos include an AI on-model image. */
  onModel?: { show: string; back: string };
};

/** A frame of the gallery: a photo (with its number among the photos) or the video. */
type Slide = { kind: "image"; img: GalleryImage; n: number } | { kind: "video" };

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
 *
 * A product with a short video (#117) shows it as the second frame, after the cover photo:
 * the cover is its poster and nothing of the video loads before the buyer presses play. The
 * full view stays photos only. Without a video the gallery is exactly the photo gallery.
 */
export function Gallery({
  productId,
  images,
  video,
  labels,
}: {
  productId: number;
  images: GalleryImage[];
  video?: GalleryVideo | null;
  labels: Labels;
}) {
  // `index` is the carousel frame, `shot` the photo of the full view.
  const [index, setIndex] = useState(0);
  const [shot, setShot] = useState(0);
  const [zoom, setZoom] = useState(false);
  const startX = useRef<number | null>(null);
  const total = images.length;
  const videoLabels = video ? labels.video : undefined;
  const slides: Slide[] = images.map((img, n) => ({ kind: "image", img, n }));
  if (video && videoLabels) slides.splice(Math.min(1, slides.length), 0, { kind: "video" });
  const frames = slides.length;
  // The hidden shots (opacity 0, same box) load after the page, not with the first
  // photo (#160); choosing a shot before that loads it at once.
  const [rest, setRest] = useState(false);
  const show = (i: number) => {
    setRest(true);
    setIndex(i);
  };
  const go = (i: number) => show((i + frames) % frames);
  const turn = (i: number) => setShot((i + total) % total);
  const open = (n: number) => {
    setRest(true);
    setShot(n);
    setZoom(true);
  };

  // "On a model" (#315): the first on-model image (never a photoshoot or an AI-edited photo),
  // when there is also a plain photo before it.
  const modelShot = images.findIndex((img) => img.onModel === true && img.aiGenerated);
  const hasModel = modelShot > 0 && Boolean(labels.onModel);
  const modelFrame = slides.findIndex((s) => s.kind === "image" && s.n === modelShot);
  const onModelNow = hasModel && index === modelFrame;
  /** Desktop grid: scroll to the on-model photo and focus it. */
  function scrollToModel() {
    const target = document.querySelector<HTMLElement>(
      `[data-gallery="${productId}"] [data-shot="${modelShot}"]`,
    );
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }
  /** The button over the cover photo; no layout below it moves. */
  const modelButton = (onClick: () => void, text: string) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className="touch-target absolute top-3 right-3 z-20 rounded-full bg-background/90 shadow-sm"
    >
      <UserRound aria-hidden />
      {text}
    </Button>
  );

  useEffect(() => {
    const load = () => setRest(true);
    if (document.readyState === "complete") return load();
    window.addEventListener("load", load, { once: true });
    return () => window.removeEventListener("load", load);
  }, []);

  function onPointerDown(e: PointerEvent) {
    // A touch on the playing video is for its controls (the timeline), not a swipe.
    if (e.target instanceof HTMLVideoElement) return;
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
    if (e.key === "ArrowRight") turn(shot + 1);
    if (e.key === "ArrowLeft") turn(shot - 1);
  }

  if (frames === 0) return null;
  const current = slides[index];
  const zoomed = images[shot];
  const position = fill(
    current.kind === "video" && videoLabels ? videoLabels.position : labels.position,
    index + 1,
    frames,
  );
  const poster = images[0] ?? null;

  /** The label on a shot: hallmark or tag (#106), else the AI mark; none for a plain photo. */
  const badgeText = (img: GalleryImage) => img.badge || (img.aiGenerated ? labels.ai : null);

  const aiBadge = (img: GalleryImage) => {
    const text = badgeText(img);
    return (
      text && (
        <Badge variant="secondary" className="absolute top-3 left-3 z-10">
          {text}
        </Badge>
      )
    );
  };

  const morph = (node: ReactNode) => (
    <ViewTransition name={`product-${productId}`} share="morph" default="none">
      {node}
    </ViewTransition>
  );

  return (
    <div data-gallery={productId}>
      {/* Phones and tablets: swipe carousel. */}
      <div
        className="relative aspect-[4/5] touch-pan-y overflow-hidden rounded-lg bg-muted select-none lg:hidden"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        aria-roledescription="carousel"
      >
        {slides.map((slide, i) => {
          const layer = cn(
            "absolute inset-0 transition-opacity duration-(--duration-slow) ease-(--ease-luxe) motion-reduce:transition-none",
            i === index ? "opacity-100" : "pointer-events-none opacity-0",
          );
          if (slide.kind === "video") {
            return (
              video &&
              videoLabels && (
                // `inert` keeps the play button of a hidden frame out of the tab order.
                <div key="video" aria-hidden={i !== index} inert={i !== index} className={layer}>
                  <VideoSlide
                    video={video}
                    poster={poster}
                    showPoster={rest}
                    sizes="100vw"
                    labels={videoLabels}
                    active={i === index}
                  />
                </div>
              )
            );
          }
          const { img, n } = slide;
          const image = (n === 0 || rest) && (
            <Image
              src={img.url}
              alt={img.alt}
              fill
              sizes={n === 0 ? FIRST_SIZES : "100vw"}
              preload={n === 0}
              fetchPriority={n === 0 ? "high" : undefined}
              unoptimized={svg(img.url)}
              className="object-cover"
            />
          );
          return (
            <div key={img.url + n} aria-hidden={i !== index} className={layer}>
              {n === 0 ? morph(image) : image}
            </div>
          );
        })}
        {current.kind === "image" && (
          <>
            {aiBadge(current.img)}
            <button
              type="button"
              onClick={() => open(current.n)}
              aria-label={labels.zoom}
              className={cn(roundButton, "absolute right-3 bottom-3")}
            >
              <Expand aria-hidden className="size-4" />
            </button>
          </>
        )}
        {frames > 1 && (
          <>
            {/* On the video frame a swipe belongs to the player, so the arrows show on phones too. */}
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={labels.prev}
              className={cn(
                roundButton,
                "absolute top-1/2 left-3 z-20 -translate-y-1/2",
                current.kind === "video" ? "inline-flex" : "hidden sm:inline-flex",
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
                "absolute top-1/2 right-3 z-20 -translate-y-1/2",
                current.kind === "video" ? "inline-flex" : "hidden sm:inline-flex",
              )}
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
            {/* Visible counter and dots; the live region below speaks the position. On the
                video frame they would cover the player's controls, so only the arrows stay. */}
            {current.kind === "image" && (
              <>
                <span
                  aria-hidden
                  className="absolute bottom-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium tabular-nums shadow-sm"
                >
                  {index + 1} / {frames}
                </span>
                <span
                  aria-hidden
                  // Full width, over the enlarge button: taps must pass through to it.
                  className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center gap-1.5"
                >
                  {slides.map((slide, i) => (
                    <span
                      key={slide.kind === "video" ? "video" : slide.img.url + slide.n}
                      className={cn(
                        "size-1.5 rounded-full bg-background shadow-sm transition-opacity duration-(--duration-base) motion-reduce:transition-none",
                        i === index ? "opacity-100" : "opacity-50",
                      )}
                    />
                  ))}
                </span>
              </>
            )}
          </>
        )}
        {/* Phones and tablets: the carousel goes to the on-model frame, or back to the first photo. */}
        {hasModel &&
          labels.onModel &&
          modelButton(
            () => show(onModelNow ? 0 : modelFrame),
            onModelNow ? labels.onModel.back : labels.onModel.show,
          )}
        <p className="sr-only" aria-live="polite">
          {position}
        </p>
      </div>

      {/* Desktop: large grid with a magnifier; a click opens the full view. */}
      <ul className="hidden grid-cols-2 gap-3 lg:grid">
        {slides.map((slide) => {
          if (slide.kind === "video") {
            return (
              video &&
              videoLabels && (
                <li key="video">
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-muted">
                    <VideoSlide video={video} poster={poster} sizes="25vw" labels={videoLabels} />
                  </div>
                </li>
              )
            );
          }
          const { img, n } = slide;
          const image = (
            <Image
              src={img.url}
              alt={img.alt}
              fill
              sizes={n === 0 ? FIRST_SIZES : "25vw"}
              fetchPriority={n === 0 ? "high" : undefined}
              unoptimized={svg(img.url)}
              className="gallery-lens object-cover"
            />
          );
          return (
            <li key={img.url + n} className={cn("relative", n === 0 && "col-span-2")}>
              <button
                type="button"
                data-shot={n}
                onClick={() => open(n)}
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
                // The badge is visible text inside the button, so the name starts with it (WCAG
                // 2.5.3, axe label-content-name-mismatch).
                aria-label={[
                  badgeText(img),
                  `${labels.zoom}: ${fill(labels.position, n + 1, total)}`,
                ]
                  .filter(Boolean)
                  .join(". ")}
                className="group/lens relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {n === 0 ? morph(image) : image}
                {aiBadge(img)}
              </button>
              {/* Over the cover photo, beside (not inside) its zoom button. */}
              {n === 0 &&
                hasModel &&
                labels.onModel &&
                modelButton(scrollToModel, labels.onModel.show)}
            </li>
          );
        })}
      </ul>

      {zoomed && (
        <Dialog open={zoom} onOpenChange={setZoom}>
          <DialogContent
            closeLabel={labels.close}
            className="max-w-[min(92vw,56rem)] p-2 sm:max-w-[min(92vw,56rem)]"
            onKeyDown={onKeyDown}
          >
            <DialogTitle className="sr-only">{zoomed.alt}</DialogTitle>
            {/* Pinch-zoom stays with the browser on touch screens. */}
            <div className="relative aspect-[4/5] max-h-[85vh] w-full touch-pinch-zoom overflow-auto">
              <Image
                src={zoomed.url}
                alt={zoomed.alt}
                fill
                sizes="92vw"
                unoptimized={svg(zoomed.url)}
                className="object-contain"
              />
              {aiBadge(zoomed)}
            </div>
            {total > 1 && (
              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                <button
                  type="button"
                  onClick={() => turn(shot - 1)}
                  aria-label={labels.prev}
                  className={roundButton}
                >
                  <ChevronLeft aria-hidden className="size-5" />
                </button>
                <p className="text-sm tabular-nums" aria-live="polite">
                  {fill(labels.position, shot + 1, total)}
                </p>
                <button
                  type="button"
                  onClick={() => turn(shot + 1)}
                  aria-label={labels.next}
                  className={roundButton}
                >
                  <ChevronRight aria-hidden className="size-5" />
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
