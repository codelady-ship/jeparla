"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Section headings that rise in when scrolled to (#172); opt out with data-no-reveal. */
const HEADINGS = "main h2:not([data-no-reveal])";
/** Images in deferred product cards fade in once loaded instead of popping in. */
const IMAGES = ".card-deferred img";

/**
 * Page-wide scroll polish, no library: below-the-fold section headings fade up once
 * (same CSS as <Reveal>), and deferred card images fade in when loaded. Only elements
 * that start off screen are touched, so nothing visible at load hides or moves (LCP,
 * CLS). Without JS or with reduced motion nothing is hidden at all.
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-reveal", "shown");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    const fold = window.innerHeight;
    for (const h of document.querySelectorAll<HTMLElement>(HEADINGS)) {
      // Already animated by a <Reveal> parent, or on screen now: leave it alone.
      if (h.closest("[data-reveal]") || h.getBoundingClientRect().top < fold) continue;
      h.setAttribute("data-reveal", "hidden");
      io.observe(h);
    }

    const loaded = (img: HTMLImageElement) => img.setAttribute("data-loaded", "");
    const onLoad = (e: Event) => {
      if (e.target instanceof HTMLImageElement && e.target.matches(IMAGES)) loaded(e.target);
    };
    // Load events do not bubble; capture them. A failed image is shown too (alt text).
    document.addEventListener("load", onLoad, true);
    document.addEventListener("error", onLoad, true);
    for (const img of document.querySelectorAll<HTMLImageElement>(IMAGES)) {
      if (img.complete) loaded(img);
      else img.setAttribute("data-fade", "");
    }
    return () => {
      io.disconnect();
      document.removeEventListener("load", onLoad, true);
      document.removeEventListener("error", onLoad, true);
    };
  }, [pathname]);

  return null;
}
