import { useId } from "react";
import { cn } from "@/lib/utils";
import { WORDMARK } from "./logo-paths";

const W = WORDMARK.width;
/** Soft edge of the pen: the reveal fades over this many units, like ink still wet. */
const FEATHER = 36;
/** Extra outline that thickens the thin script into a bold stroke (owner, 2026-11-22). */
const BOLD = 4;

/**
 * The script wordmark written by hand (owner, 2026-11-22): the letters appear left to right
 * behind a soft-edged pen, in a bold stroke, then the ring is drawn onto the "J" and its
 * stone lights up. Progress is the CSS variable `--write` (0 to 1) on any ancestor, set by
 * the hero's scroll motion; without it (reduced motion, no script) the word is complete.
 * Only `transform`, `opacity` and `stroke-dashoffset` change, so nothing reflows.
 */
export function HandwrittenWordmark({ className }: { className?: string }) {
  const id = useId();
  const mask = `hw-mask-${id}`;
  const fade = `hw-fade-${id}`;
  const { ring } = WORDMARK;
  return (
    <svg
      viewBox={`0 0 ${W} ${WORDMARK.height}`}
      aria-hidden="true"
      focusable="false"
      className={cn("handwritten block h-[1.45em] w-auto overflow-visible", className)}
    >
      <defs>
        <linearGradient id={fade} x1="0" x2="1" y1="0" y2="0">
          <stop offset={W / (W + FEATHER)} stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask
          id={mask}
          maskUnits="userSpaceOnUse"
          x={-FEATHER}
          y={-20}
          width={W + FEATHER * 2}
          height={WORDMARK.height + 40}
        >
          <rect
            className="handwritten-pen"
            x={0}
            y={-20}
            width={W + FEATHER}
            height={WORDMARK.height + 40}
            fill={`url(#${fade})`}
          />
        </mask>
      </defs>
      <path
        className="handwritten-ring fill-none stroke-scene-gold-deep dark:stroke-gold"
        pathLength={1}
        strokeWidth={ring.stroke * 1.25}
        strokeLinecap="round"
        d={ring.back}
      />
      <path
        mask={`url(#${mask})`}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={BOLD}
        strokeLinejoin="round"
        d={WORDMARK.letters}
      />
      <path
        className="handwritten-ring fill-none stroke-gold dark:stroke-scene-gold-light"
        pathLength={1}
        strokeWidth={ring.stroke * 1.25}
        strokeLinecap="round"
        d={ring.front}
      />
      <path
        className="handwritten-stone fill-scene-gold-light stroke-scene-gold-deep"
        strokeWidth={ring.stoneStroke}
        strokeLinejoin="round"
        d={ring.stone}
      />
    </svg>
  );
}
