"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type HeroMode = "pending" | "motion" | "static";

/**
 * Progressive motion layer for <CinematicHero>. The server HTML is a complete
 * static frame; this loads GSAP + ScrollTrigger after hydration (home page
 * only) and pins the hero while scroll drives the timeline. Reduced motion, or
 * a failed import, switches to the static layout (data-mode="static").
 */
export function HeroMotion({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const setMode = (mode: HeroMode) => {
      root.dataset.mode = mode;
    };
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setMode("static");
      return;
    }

    let cancelled = false;
    let revert: (() => void) | undefined;

    Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("./hero-timeline")])
      .then(([{ gsap }, { ScrollTrigger }, { desktopTimeline, mobileTimeline }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        // The address bar showing and hiding on phones must not re-layout the pin.
        ScrollTrigger.config({ ignoreMobileResize: true });
        const mm = gsap.matchMedia(root);
        mm.add(
          {
            desktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
            mobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
            reduce: "(prefers-reduced-motion: reduce)",
          },
          (context) => {
            const { desktop, mobile } = context.conditions ?? {};
            if (!desktop && !mobile) {
              setMode("static");
              return;
            }
            setMode("motion");
            if (desktop) desktopTimeline(gsap, root);
            else mobileTimeline(gsap, root);
          },
        );
        revert = () => mm.revert();
      })
      .catch(() => {
        if (!cancelled) setMode("static");
      });

    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);

  return (
    <section ref={ref} aria-label={label} data-hero data-mode="pending" className="hero">
      {children}
    </section>
  );
}
