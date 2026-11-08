/**
 * Scroll-scrubbed frame sequence (the hero videos, exported as still frames).
 * Pure helpers are separate from the loader so they can be unit-tested.
 */

/** Frame index shown at scroll progress p (0..1) for a sequence of `count` frames. */
export function frameAt(progress: number, count: number) {
  if (count <= 0) return -1;
  const p = Math.min(Math.max(progress, 0), 1);
  return Math.round(p * (count - 1));
}

/**
 * Coarse-to-fine load order: first and last frame, then every 16th, 8th, ...
 * so the whole scroll range is playable (at low frame rate) after a few requests,
 * and gaps fill in as more frames arrive.
 */
export function loadOrder(count: number): number[] {
  if (count <= 0) return [];
  const order: number[] = [0];
  const seen = new Set(order);
  const push = (i: number) => {
    if (!seen.has(i)) {
      seen.add(i);
      order.push(i);
    }
  };
  push(count - 1);
  let step = 1;
  while (step * 2 < count) step *= 2;
  for (; step >= 1; step /= 2) for (let i = 0; i < count; i += step) push(i);
  return order;
}

/** Nearest loaded frame to `index` (searching outward), or -1 if none is loaded. */
export function nearestLoaded(index: number, loaded: ArrayLike<unknown>) {
  const n = loaded.length;
  for (let d = 0; d < n; d++) {
    if (index - d >= 0 && loaded[index - d]) return index - d;
    if (index + d < n && loaded[index + d]) return index + d;
  }
  return -1;
}

export type FrameSource = { count: number; url: (i: number) => string };

/**
 * Plays a frame sequence in one <img>: frames are fetched and decoded in
 * coarse-to-fine order with a small concurrency limit, and `show(progress)`
 * points the image at the closest frame already decoded. The browser scales it
 * (object-fit in CSS), so no canvas backing store is needed.
 */
export class FramePlayer {
  private loaded: boolean[];
  private wanted = 0;
  private shown = -1;
  private stopped = false;

  constructor(
    private target: HTMLImageElement,
    private source: FrameSource,
    private concurrency = 4,
  ) {
    this.loaded = new Array(source.count).fill(false);
  }

  start() {
    const queue = loadOrder(this.source.count);
    const next = () => {
      if (this.stopped) return;
      const i = queue.shift();
      if (i === undefined) return;
      const img = new Image();
      img.src = this.source.url(i);
      const ready =
        typeof img.decode === "function"
          ? img.decode()
          : new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = reject;
            });
      ready
        .then(() => {
          this.loaded[i] = true;
          // A closer frame may now be available for the current position.
          this.render();
        })
        .catch(() => {})
        .finally(next);
    };
    for (let k = 0; k < this.concurrency; k++) next();
    return this;
  }

  stop() {
    this.stopped = true;
  }

  show(progress: number) {
    this.wanted = frameAt(progress, this.source.count);
    this.render();
  }

  private render() {
    const i = nearestLoaded(this.wanted, this.loaded);
    if (i < 0 || i === this.shown) return;
    this.target.src = this.source.url(i);
    this.shown = i;
  }
}
