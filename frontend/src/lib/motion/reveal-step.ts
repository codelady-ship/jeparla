import type { CSSProperties } from "react";

/**
 * Props for one item of a staggered <Reveal stagger>: it comes in `step` beats after the
 * group starts (one beat is --reveal-stagger). Use when the items are not siblings, or to
 * set the order by hand; siblings get their position by default.
 */
export function revealStep(step: number) {
  return {
    "data-reveal-item": "",
    style: { "--reveal-item": Math.min(step, 8) } as CSSProperties,
  };
}
