"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { clampCrop, moveCrop, resizeCrop, type CropRect } from "@/lib/search/image";

/** Keyboard step of the frame, as a fraction of the photo. */
const STEP = 0.02;

/**
 * Framing the item before search by photo (#163): a frame over the photo that the
 * buyer drags (mouse or finger), resizes by its corner handle, or moves with the
 * arrow keys (Shift + arrows resize). Pure UI: the parent crops the photo.
 */
export function PhotoCrop({
  src,
  crop,
  onChange,
  label,
  hintId,
}: {
  src: string;
  crop: CropRect;
  onChange: (crop: CropRect) => void;
  label: string;
  hintId: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "resize"; x: number; y: number; start: CropRect } | null>(
    null,
  );

  function begin(mode: "move" | "resize", e: PointerEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, start: crop };
  }

  function update(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    const rect = box.current?.getBoundingClientRect();
    if (!d || !rect || rect.width === 0 || rect.height === 0) return;
    const dx = (e.clientX - d.x) / rect.width;
    const dy = (e.clientY - d.y) / rect.height;
    onChange(d.mode === "move" ? moveCrop(d.start, dx, dy) : resizeCrop(d.start, dx, dy));
  }

  function end() {
    drag.current = null;
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-STEP, 0],
      ArrowRight: [STEP, 0],
      ArrowUp: [0, -STEP],
      ArrowDown: [0, STEP],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    onChange(e.shiftKey ? resizeCrop(crop, d[0], d[1]) : moveCrop(crop, d[0], d[1]));
  }

  const c = clampCrop(crop);
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  return (
    <div
      ref={box}
      className="relative mx-auto w-fit touch-none overflow-hidden rounded-md select-none"
    >
      {/* A local object URL of the prepared photo: next/image cannot optimise it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="block max-h-[50vh] w-auto max-w-full" />
      {/* Dimmed area outside the frame. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 bg-background/70"
        style={{ height: pct(c.y) }}
      />
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 bg-background/70"
        style={{ height: pct(1 - c.y - c.h) }}
      />
      <span
        aria-hidden
        className="absolute left-0 bg-background/70"
        style={{ top: pct(c.y), height: pct(c.h), width: pct(c.x) }}
      />
      <span
        aria-hidden
        className="absolute right-0 bg-background/70"
        style={{ top: pct(c.y), height: pct(c.h), width: pct(1 - c.x - c.w) }}
      />
      <div
        role="group"
        tabIndex={0}
        aria-label={label}
        aria-describedby={hintId}
        onKeyDown={onKey}
        onPointerDown={(e) => begin("move", e)}
        onPointerMove={update}
        onPointerUp={end}
        onPointerCancel={end}
        className="absolute cursor-move border-2 border-gold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ left: pct(c.x), top: pct(c.y), width: pct(c.w), height: pct(c.h) }}
      >
        <span
          aria-hidden
          onPointerDown={(e) => begin("resize", e)}
          onPointerMove={update}
          onPointerUp={end}
          onPointerCancel={end}
          className="absolute right-0 bottom-0 size-6 cursor-se-resize rounded-full border-2 border-gold bg-background"
        />
      </div>
    </div>
  );
}
