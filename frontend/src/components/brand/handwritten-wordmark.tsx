import type { CSSProperties } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { LETTERS, PEN_BOLD, PEN_FEATHER } from "./handwriting";
import { WORDMARK } from "./logo-paths";

/**
 * The script wordmark written by hand, letter by letter (owner, 2026-11-22): J, e, p, a,
 * r, l, a appear one after another, each behind its own soft-edged pen, in a bold stroke;
 * then the ring is drawn onto the "J" and its stone lights up. Progress is the CSS variable
 * `--write` (0 to 1) on any ancestor, set by the hero's scroll motion; without it (reduced
 * motion, no script) the word is complete. Only `transform`, `opacity` and
 * `stroke-dashoffset` change, so nothing reflows. Timing: ./handwriting.ts.
 */
export function HandwrittenWordmark({ className }: { className?: string }) {
  const id = useId();
  const { ring, height } = WORDMARK;
  return (
    <svg
      viewBox={`0 0 ${WORDMARK.width} ${height}`}
      aria-hidden="true"
      focusable="false"
      className={cn("handwritten block h-[1.45em] w-auto overflow-visible", className)}
    >
      <defs>
        {LETTERS.map((l, i) => (
          <linearGradient key={i} id={`${id}-fade-${i}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset={1 - PEN_FEATHER / (l.travel + 4)} stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
        ))}
        {LETTERS.map((l, i) => (
          <mask
            key={i}
            id={`${id}-pen-${i}`}
            maskUnits="userSpaceOnUse"
            x={l.x0 - 40}
            y={-30}
            width={l.travel + 80}
            height={height + 60}
          >
            <rect
              className="handwritten-pen"
              style={{ "--a": l.start, "--b": l.span, "--w": l.travel + 4 } as CSSProperties}
              x={l.x0 - 4}
              y={-30}
              width={l.travel + 4}
              height={height + 60}
              fill={`url(#${id}-fade-${i})`}
            />
          </mask>
        ))}
      </defs>
      <path
        className="handwritten-ring fill-none stroke-scene-gold-deep dark:stroke-gold"
        pathLength={1}
        strokeWidth={ring.stroke * 1.25}
        strokeLinecap="round"
        d={ring.back}
      />
      {LETTERS.map((l, i) => (
        <path
          key={i}
          mask={`url(#${id}-pen-${i})`}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={PEN_BOLD}
          strokeLinejoin="round"
          d={l.d}
        />
      ))}
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
