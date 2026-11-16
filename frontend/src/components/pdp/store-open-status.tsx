"use client";

import { Clock } from "lucide-react";
import { useLocale } from "next-intl";
import { useSyncExternalStore } from "react";
import { openState } from "@/lib/opening-hours";
import { cn } from "cn";

export type StoreStatusLabels = {
  open: string;
  /** Raw templates with {time} and {day}. */
  closedToday: string;
  closedTomorrow: string;
  closedOn: string;
  /** Left out on store cards (#116), where the line stays short. */
  closedHint?: string;
};

// The current minute, so the status refreshes while the page stays open.
const subscribe = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(timer);
};
const minute = () => Math.floor(Date.now() / 60_000);
// Server and first client render show nothing: the time is only known in the browser.
const noMinute = () => null;

/** "Open now" or "closed, opens at ..." in Baku time. The WhatsApp button works either way. */
export function StoreOpenStatus({
  openingHours,
  labels,
  className,
}: {
  openingHours: string;
  labels: StoreStatusLabels;
  className?: string;
}) {
  const locale = useLocale();
  const now = useSyncExternalStore(subscribe, minute, noMinute);
  if (now === null) return null;
  const state = openState(openingHours, new Date(now * 60_000));
  if (!state) return null;

  let text = labels.open;
  if (!state.open) {
    const at = state.opensAt;
    if (!at) return null;
    const template =
      at.inDays === 0
        ? labels.closedToday
        : at.inDays === 1
          ? labels.closedTomorrow
          : labels.closedOn;
    // 2024-01-01 was a Monday.
    const day = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, 1 + at.day)),
    );
    text = template.replace("{time}", at.time).replace("{day}", day);
  }

  return (
    <p className={cn("flex items-start gap-2 text-sm text-muted-foreground", className)}>
      <Clock aria-hidden className={cn("mt-0.5 size-4 shrink-0", state.open && "text-success")} />
      <span>
        {text}
        {!state.open && labels.closedHint && <span className="block">{labels.closedHint}</span>}
      </span>
    </p>
  );
}
