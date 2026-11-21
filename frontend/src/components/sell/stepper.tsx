"use client";

import { Check, ChevronRight } from "lucide-react";
import { cn } from "cn";

/**
 * Steps joined by arrows. Finished steps turn green and can be revisited;
 * the current one carries aria-current="step"; later ones are not reachable yet.
 */
export function Stepper({
  steps,
  current,
  done,
  onSelect,
  label,
  doneLabel,
}: {
  steps: string[];
  current: number;
  done: readonly number[];
  onSelect: (step: number) => void;
  label: string;
  doneLabel: string;
}) {
  return (
    <nav aria-label={label}>
      <ol className="flex items-center gap-1 sm:gap-2">
        {steps.map((title, i) => {
          const n = i + 1;
          const isDone = done.includes(n) && n !== current;
          const isCurrent = n === current;
          const reachable = isDone || isCurrent;
          const badge = (
            <span
              aria-hidden
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums",
                isDone && "border-success bg-success text-background",
                isCurrent && "border-primary bg-primary text-primary-foreground",
                !isDone && !isCurrent && "border-border text-muted-foreground",
              )}
            >
              {isDone ? <Check className="size-4" strokeWidth={3} /> : n}
            </span>
          );
          const text = (
            <span
              className={cn(
                "truncate text-sm",
                // Phones show only the current step's title; the others keep theirs for
                // screen readers, so a finished step's button still has a name (#176, axe).
                isCurrent ? "font-semibold" : "max-sm:sr-only",
                isDone && "text-success",
                !reachable && "text-muted-foreground",
              )}
            >
              {title}
              {isDone && <span className="sr-only"> ({doneLabel})</span>}
            </span>
          );
          return (
            <li
              key={title}
              className={cn(
                "flex min-w-0 items-center gap-1 sm:gap-2",
                isCurrent && "flex-1 sm:flex-none",
              )}
            >
              {i > 0 && (
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              )}
              {isDone ? (
                <button
                  type="button"
                  onClick={() => onSelect(n)}
                  className="touch-target relative flex min-w-0 items-center gap-2 rounded-full pr-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {badge}
                  {text}
                </button>
              ) : (
                <span
                  className="flex min-w-0 items-center gap-2"
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {badge}
                  {text}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
