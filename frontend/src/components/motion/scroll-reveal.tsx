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
 *
 * Where a heading is comes from an IntersectionObserver, not getBoundingClientRect():
 * reading positions while the page hydrates forced a layout of the whole page, including
 * the sections the browser was skipping (content-visibility), on the phone's main
 * thread (#62). The observer reports after the next frame, from the layout it has.
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
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-reveal", "shown");
          reveal.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    // First report per heading: on screen or already scrolled past -> left alone;
    // below the fold (or not rendered yet) -> hidden until it scrolls in.
    const probe = new IntersectionObserver((entries) => {
      for (const e of entries) {
        probe.unobserve(e.target);
        const r = e.boundingClientRect;
        if (e.isIntersecting || (r.height > 0 && r.bottom <= 0)) continue;
        e.target.setAttribute("data-reveal", "hidden");
        reveal.observe(e.target);
      }
    });
    for (const h of document.querySelectorAll<HTMLElement>(HEADINGS)) {
      // Already animated by a <Reveal> parent: leave it alone.
      if (!h.closest("[data-reveal]")) probe.observe(h);
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
      probe.disconnect();
      reveal.disconnect();
      document.removeEventListener("load", onLoad, true);
      document.removeEventListener("error", onLoad, true);
    };
  }, [pathname]);

  return null;
}
