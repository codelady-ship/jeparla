/**
 * Tiny scroll-scrubbed timeline (replaces GSAP for the home hero, which did not
 * fit the 250 KB script budget). Tweens are placed on a time axis like GSAP's
 * `to` / `fromTo`; `resolve(t)` returns every target's values at time t, and
 * `apply` writes them as transform / opacity / visibility only (no layout).
 *
 * Semantics follow GSAP where it matters:
 * - before a `fromTo` starts, the target shows its `from` values (immediate render);
 * - a `to` starts from whatever the property was when it begins;
 * - after a tween ends, the target holds its `to` values.
 */

export type Props = {
  x?: number;
  y?: number;
  xPercent?: number;
  yPercent?: number;
  scale?: number;
  /** Opacity that also hides the element (visibility) at 0, like GSAP's autoAlpha. */
  alpha?: number;
  /** Plain opacity, element stays visible. */
  opacity?: number;
  radius?: number;
};

type Key = keyof Props;
const DEFAULTS: Required<Props> = {
  x: 0,
  y: 0,
  xPercent: 0,
  yPercent: 0,
  scale: 1,
  alpha: 1,
  opacity: 1,
  radius: 0,
};

type Tween<T> = { target: T; from?: Props; to: Props; start: number; end: number };

export class Timeline<T = HTMLElement> {
  private tweens: Tween<T>[] = [];

  /** Total length in timeline units. */
  get duration() {
    return this.tweens.reduce((max, tw) => Math.max(max, tw.end), 0);
  }

  to(targets: T | T[], to: Props, at: number, duration: number, stagger = 0) {
    return this.add(targets, undefined, to, at, duration, stagger);
  }

  fromTo(targets: T | T[], from: Props, to: Props, at: number, duration: number, stagger = 0) {
    return this.add(targets, from, to, at, duration, stagger);
  }

  private add(
    targets: T | T[],
    from: Props | undefined,
    to: Props,
    at: number,
    duration: number,
    stagger: number,
  ) {
    const list = Array.isArray(targets) ? targets : [targets];
    list.forEach((target, i) => {
      const start = at + i * stagger;
      this.tweens.push({ target, from, to, start, end: start + duration });
    });
    return this;
  }

  /** Targets that this timeline writes to. */
  targets(): T[] {
    return [...new Set(this.tweens.map((tw) => tw.target))];
  }

  /** Values of every animated property of every target at time t. */
  resolve(t: number): Map<T, Props> {
    const out = new Map<T, Props>();
    const byTarget = new Map<T, Tween<T>[]>();
    for (const tw of [...this.tweens].sort((a, b) => a.start - b.start)) {
      const list = byTarget.get(tw.target) ?? [];
      list.push(tw);
      byTarget.set(tw.target, list);
    }
    for (const [target, list] of byTarget) {
      const keys = new Set<Key>(list.flatMap((tw) => Object.keys(tw.to) as Key[]));
      const values: Props = {};
      for (const key of keys) {
        const own = list.filter((tw) => key in tw.to);
        // Immediate render: a fromTo shows its start value before it begins.
        let value = own[0].from?.[key] ?? DEFAULTS[key];
        for (const tw of own) {
          const from = tw.from?.[key] ?? value;
          const to = tw.to[key]!;
          if (t <= tw.start) break;
          if (t >= tw.end) {
            value = to;
            continue;
          }
          const k = (t - tw.start) / (tw.end - tw.start);
          value = from + (to - from) * k;
          break;
        }
        values[key] = value;
      }
      out.set(target, values);
    }
    return out;
  }
}

/** CSS for one target's values; only the properties it animates. */
export function toStyle(
  v: Props,
): Partial<Record<"transform" | "opacity" | "visibility" | "borderRadius", string>> {
  const style: Partial<Record<"transform" | "opacity" | "visibility" | "borderRadius", string>> =
    {};
  const moves = ["x", "y", "xPercent", "yPercent", "scale"].some((k) => k in v);
  if (moves) {
    const tp = `translate(${round(v.xPercent ?? 0)}%, ${round(v.yPercent ?? 0)}%)`;
    const tx = `translate(${round(v.x ?? 0)}px, ${round(v.y ?? 0)}px)`;
    style.transform = `${tp} ${tx} scale(${round(v.scale ?? 1, 4)})`;
  }
  const alpha = v.alpha ?? v.opacity;
  if (alpha !== undefined) style.opacity = String(round(alpha, 3));
  if (v.alpha !== undefined) style.visibility = v.alpha <= 0.001 ? "hidden" : "visible";
  if (v.radius !== undefined) style.borderRadius = `${round(v.radius)}px`;
  return style;
}

function round(n: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Writes timeline values at time t to the DOM. */
export function apply(tl: Timeline<HTMLElement>, t: number) {
  for (const [el, values] of tl.resolve(t)) Object.assign(el.style, toStyle(values));
}

/** Removes everything `apply` wrote, so CSS takes over again. */
export function clear(tl: Timeline<HTMLElement>) {
  for (const el of tl.targets()) {
    el.style.transform = "";
    el.style.opacity = "";
    el.style.visibility = "";
    el.style.borderRadius = "";
  }
}

/** Scroll progress 0..1 of a tall track whose sticky stage stays on screen. */
export function trackProgress(trackTop: number, trackHeight: number, viewport: number) {
  const distance = trackHeight - viewport;
  if (distance <= 0) return 0;
  return Math.min(Math.max(-trackTop / distance, 0), 1);
}
