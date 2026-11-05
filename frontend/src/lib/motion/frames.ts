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

/** Source rectangle that makes an image cover a box (like object-fit: cover). */
export function coverRect(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
  focusX = 0.5,
  focusY = 0.5,
) {
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const sw = boxW / scale;
  const sh = boxH / scale;
  return {
    sx: (imgW - sw) * focusX,
    sy: (imgH - sh) * focusY,
    sw,
    sh,
  };
}

export type FrameSource = { count: number; url: (i: number) => string };

/**
 * Draws a frame sequence on a canvas. Frames load in coarse-to-fine order with a
 * small concurrency limit; `show(progress)` draws the closest frame already loaded.
 * The canvas keeps its CSS size; its backing store follows devicePixelRatio (capped).
 */
export class FramePlayer {
  private images: (HTMLImageElement | undefined)[];
  private wanted = 0;
  private drawn = -1;
  private stopped = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private source: FrameSource,
    private focus = { x: 0.5, y: 0.5 },
    private concurrency = 4,
  ) {
    this.images = new Array(source.count);
  }

  start() {
    const queue = loadOrder(this.source.count);
    const next = () => {
      if (this.stopped) return;
      const i = queue.shift();
      if (i === undefined) return;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        this.images[i] = img;
        // Redraw if this frame is closer to the wanted one than what is shown.
        this.draw(this.wanted);
        next();
      };
      img.onerror = next;
      img.src = this.source.url(i);
    };
    for (let k = 0; k < this.concurrency; k++) next();
    return this;
  }

  stop() {
    this.stopped = true;
  }

  show(progress: number) {
    this.wanted = frameAt(progress, this.source.count);
    this.draw(this.wanted);
  }

  /** Resizes the backing store to the CSS box; call on resize. */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.drawn = -1;
    this.draw(this.wanted);
  }

  private draw(index: number) {
    const i = nearestLoaded(index, this.images);
    if (i < 0 || i === this.drawn) return;
    const img = this.images[i]!;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = this.canvas;
    const r = coverRect(img.naturalWidth, img.naturalHeight, w, h, this.focus.x, this.focus.y);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
    this.drawn = i;
  }
}
