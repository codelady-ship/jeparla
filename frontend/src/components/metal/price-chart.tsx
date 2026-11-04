"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type ChartPoint = {
  /** "03.11" style label, already formatted on the server. */
  date: string;
  /** Formatted price for the tooltip. */
  label: string;
  /** Numeric value for the geometry only; money math stays in decimals. */
  y: number;
};

const TOP = 10;
const BOTTOM = 90;

/**
 * One series, so no legend: the title above names it. Thin 2px line in the
 * gold text token (>= 3:1 on the card in both themes), recessive grid, the
 * latest point marked and labelled. Hover or arrow keys move a crosshair with a
 * tooltip; the same data is in a table next to the chart.
 */
export function PriceChart({
  points,
  summary,
  maxLabel,
  minLabel,
}: {
  points: ChartPoint[];
  /** Spoken name of the chart, e.g. "Gold 585, last 30 business days". */
  summary: string;
  maxLabel: string;
  minLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const n = points.length;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) =>
    max === min ? 50 : TOP + (1 - (v - min) / (max - min)) * (BOTTOM - TOP);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.y)}`).join(" ");
  const last = n - 1;
  const shown = active ?? last;

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const rect = plot.current?.getBoundingClientRect();
    if (!rect || n < 2) return;
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setActive(Math.round(ratio * (n - 1)));
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const current = active ?? last;
    const next =
      e.key === "ArrowLeft"
        ? current - 1
        : e.key === "ArrowRight"
          ? current + 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setActive(Math.min(Math.max(next, 0), last));
  }

  if (n === 0) return null;
  const tipLeft = x(shown);

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <div className="flex flex-col justify-between py-[calc(10%-0.5rem)] text-right tabular-nums">
        <span>{maxLabel}</span>
        <span>{minLabel}</span>
      </div>
      <div
        ref={plot}
        role="group"
        tabIndex={0}
        aria-label={summary}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(last)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
        className="relative h-40 touch-pan-y rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          {[TOP, 50, BOTTOM].map((g) => (
            <line
              key={g}
              x1="0"
              x2="100"
              y1={g}
              y2={g}
              className="stroke-border"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1="0"
              y2="100"
              className="stroke-muted-foreground"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={path}
            fill="none"
            className="stroke-gold-text"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          aria-hidden
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-text ring-2 ring-card"
          style={{ left: `${x(shown)}%`, top: `${y(points[shown].y)}%` }}
        />
        <div
          aria-live="polite"
          className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2 py-1 whitespace-nowrap text-popover-foreground shadow-sm"
          style={{
            left: `${tipLeft}%`,
            // Just above the marked point; the 2.5rem padding above the plot keeps it inside the card.
            top: `calc(${y(points[shown].y)}% - 0.75rem)`,
            transform: `translate(${tipLeft > 70 ? "-100%" : tipLeft < 30 ? "0" : "-50%"}, -100%)`,
          }}
        >
          <span className="text-muted-foreground">{points[shown].date}</span>{" "}
          <span className="font-semibold tabular-nums">{points[shown].label}</span>
        </div>
      </div>
      <span />
      <div className="flex justify-between tabular-nums">
        <span>{points[0].date}</span>
        <span>{points[last].date}</span>
      </div>
    </div>
  );
}
