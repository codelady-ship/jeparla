"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { apply, clear, trackProgress, type Timeline } from "@/lib/motion/scrub";
import { desktopTimeline, mobileTimeline } from "./hero-timeline";

export type HeroMode = "pending" | "motion" | "static";

/** Scroll smoothing time constant in ms: the playhead closes ~63% of the gap per TAU,
 *  measured in real time so slow or throttled frames do not make it lag. */
const TAU = 110;

/**
 * Progressive motion layer for <CinematicHero>. The server HTML is a complete
 * static frame. With motion allowed, CSS makes the section a tall track with a
 * sticky stage (no JS needed for the pin), and this drives the timeline from the
 * track's scroll position with a passive listener and requestAnimationFrame.
 * Reduced motion switches to the static layout (data-mode="static").
 */
export function HeroMotion({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const track = ref.current;
    const stage = track?.firstElementChild as HTMLElement | null;
    if (!track || !stage) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 768px)");

    let tl: Timeline | null = null;
    let target = 0;
    let current = 0;
    let frame = 0;
    let last = 0;

    const tick = (now: number) => {
      frame = 0;
      if (!tl) return;
      const dt = last ? Math.min(now - last, 500) : 16;
      last = now;
      current += (target - current) * (1 - Math.exp(-dt / TAU));
      if (Math.abs(target - current) < 0.0005) current = target;
      apply(tl, current * tl.duration);
      if (current !== target) frame = requestAnimationFrame(tick);
      else last = 0;
    };
    const measure = () => {
      const rect = track.getBoundingClientRect();
      target = trackProgress(rect.top, track.offsetHeight, stage.offsetHeight);
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const build = () => {
      if (tl) clear(tl);
      if (reduce.matches) {
        tl = null;
        track.dataset.mode = "static";
        return;
      }
      track.dataset.mode = "motion";
      tl = desktop.matches ? desktopTimeline(stage) : mobileTimeline(stage);
      measure();
      current = target;
      apply(tl, current * tl.duration);
    };

    build();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    reduce.addEventListener("change", build);
    desktop.addEventListener("change", build);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      reduce.removeEventListener("change", build);
      desktop.removeEventListener("change", build);
      if (frame) cancelAnimationFrame(frame);
      if (tl) clear(tl);
    };
  }, []);

  return (
    <section ref={ref} aria-label={label} data-hero data-mode="pending" className="hero-track">
      <div className="hero">{children}</div>
    </section>
  );
}
