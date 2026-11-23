"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { FramePlayer } from "@/lib/motion/frames";
import { trackProgress } from "@/lib/motion/scrub";
import {
  HERO_DESKTOP_QUERY,
  HERO_FIGURES,
  HERO_FRAMES,
  HERO_MEDIA,
  HERO_MODELS,
  HERO_POSTER,
  HERO_PHASES,
  HERO_TYPES,
  HERO_ZOOM,
  frameUrl,
  heroCamera,
  phase,
  pickHeroVideo,
} from "./hero-media";

export type HeroMode = "pending" | "motion" | "static";

/** Reveal the copy even if the video never reports its end (ms). */
const REVEAL_TIMEOUT = 6000;

/**
 * Media and scroll layer of <CinematicHero>.
 * - Act 1: the entrance video autoplays (muted, inline, no loop) and holds its
 *   last frame; when it ends the copy is revealed (.is-revealed).
 * - Act 2: scrolling the sticky track draws the transformation frames on a
 *   image and fades the scroll hint out. Frames load after act 1, so they
 *   never compete with the first paint.
 * - The backdrop colour is read from the video at runtime, so page and footage
 *   share one continuous cream whatever the encoder did to it.
 * - Reduced motion: no autoplay and no pin; the final frame (the three models)
 *   is shown at once. Never blank: the copy is revealed on end, error, a failed
 *   play() and after a timeout; when the film cannot play at all (no decoder,
 *   blocked autoplay, it never started) the tigers standing, the first frame of
 *   act 2, replace it (#322). An MP4 error tries the WebM copy once first.
 */
export function HeroMotion({
  label,
  scene,
  children,
}: {
  label: string;
  scene: string;
  children: ReactNode;
}) {
  const trackRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const framesRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const video = videoRef.current;
    const frames = framesRef.current;
    const stage = track?.firstElementChild as HTMLElement | null;
    if (!track || !video || !frames || !stage) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desktop = window.matchMedia(HERO_DESKTOP_QUERY).matches;
    const media = desktop ? HERO_MEDIA.desktop : HERO_MEDIA.mobile;
    const hint = stage.querySelector<HTMLElement>("[data-hero-hint]");
    const brand = stage.querySelector<HTMLElement>("[data-hero-brand]");
    const lens = frames.parentElement!;
    const copy = stage.querySelector<HTMLElement>(".hero-copy");
    const rail = stage.querySelector<HTMLElement>("[data-hero-scenes]");
    const steps = rail ? [...rail.querySelectorAll<HTMLElement>("li")] : [];
    const bars = rail ? [...rail.querySelectorAll<HTMLElement>("[data-scene-bar]")] : [];
    const cut = desktop ? "desktop" : "mobile";
    const player = new FramePlayer(frames, {
      count: HERO_FRAMES,
      url: (i) => frameUrl(media.frames, i),
    });

    let started = false;
    let landed = false;
    let failed = false;
    let triedWebm = false;
    let frame = 0;
    let active = -1;
    // Camera geometry in the media box's own pixels, measured without the camera applied.
    let geo: { w: number; x0: number; fw: number; bottom: number; max: number } | null = null;

    const measure = () => {
      lens.style.transform = "";
      const box = lens.getBoundingClientRect();
      const r = frames.getBoundingClientRect();
      const nw = desktop ? 1920 : 1080;
      const nh = desktop ? 1080 : 1920;
      const scale = (desktop ? Math.max : Math.min)(r.width / nw, r.height / nh);
      const fw = nw * scale;
      const fh = nh * scale;
      const x0 = r.left + (r.width - fw) / 2 - box.left;
      const hero = stage.getBoundingClientRect();
      const bottom = Math.min(r.bottom, hero.bottom) - box.top;
      const figTop = r.bottom - fh * (1 - HERO_FIGURES[cut].top) - box.top;
      // Heads may rise only to just under the header (desktop) or the copy (phone).
      const limit =
        (desktop ? hero.top + 80 : (copy?.getBoundingClientRect().bottom ?? 0) + 8) - box.top;
      const max = Math.max(
        1,
        Math.min(HERO_ZOOM[cut], (bottom - limit) / Math.max(bottom - figTop, 1)),
      );
      geo = { w: box.width, x0, fw, bottom, max };
    };

    /** Zooms toward a model's feet so heads grow up into the empty backdrop. Transform only. */
    const camera = (p: number) => {
      if (!geo) measure();
      const g = geo!;
      const { zoom, focus } = heroCamera(p, HERO_MODELS[cut]);
      const s = 1 + (g.max - 1) * zoom;
      if (s === 1) {
        lens.style.transform = "";
        return;
      }
      const ox = g.x0 + g.fw * focus;
      lens.style.transform = `translate(${(ox * (1 - s)).toFixed(1)}px, ${(g.bottom * (1 - s)).toFixed(1)}px) scale(${s.toFixed(4)})`;
    };

    const scenes = (p: number) => {
      if (!rail) return;
      rail.style.opacity = String(phase(p, HERO_PHASES.scenesIn));
      let now = -1;
      HERO_PHASES.scenes.forEach((range, i) => {
        const f = phase(p, range);
        bars[i]?.style.setProperty("transform", `scaleX(${f.toFixed(3)})`);
        if (p >= range[0]) now = i;
      });
      if (now !== active) {
        steps.forEach((li, i) =>
          i === now ? li.setAttribute("aria-current", "step") : li.removeAttribute("aria-current"),
        );
        active = now;
      }
    };

    // One pixel of the video, read after the visitor first scrolls, touches or types, when
    // the main thread is idle. Reading a video frame back costs 100-300 ms of blocking time
    // on a throttled phone, so it stays out of the page load (#160). The token cream and the
    // decoded footage differ by one unit in Chrome (247 243 234 vs 235), so nothing visible
    // waits for it; it corrects engines that shift video colours more.
    let idle = 0;
    let sampled = false;
    const sampleBackdrop = () => {
      if (sampled) return;
      sampled = true;
      const run = () => {
        idle = 0;
        readBackdrop();
      };
      idle =
        typeof requestIdleCallback === "function"
          ? requestIdleCallback(run, { timeout: 2000 })
          : window.setTimeout(run, 200);
    };
    const readBackdrop = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        const ctx = c.getContext("2d");
        if (!ctx || !video.videoWidth) return;
        ctx.drawImage(video, video.videoWidth * 0.04, video.videoHeight * 0.06, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        stage.style.setProperty("--hero-bg", `rgb(${r} ${g} ${b})`);
      } catch {
        // Pixel readback can be blocked; the CSS cream stays.
      }
    };
    const startFrames = () => {
      if (started) return;
      started = true;
      player.start();
    };
    const land = () => {
      if (landed) return;
      landed = true;
      stage.classList.add("is-revealed");
      startFrames();
    };
    /** The film will not play: show the frame it ends on instead of the plain backdrop. */
    const fallback = () => {
      failed = true;
      frames.style.opacity = "1";
      land();
    };
    const onError = () => {
      if (!triedWebm && video.src.endsWith(".mp4") && video.canPlayType(HERO_TYPES.webm)) {
        triedWebm = true;
        video.src = media.webm;
        if (!landed) video.play()?.catch(fallback);
        return;
      }
      fallback();
    };

    const render = () => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      const p = trackProgress(rect.top, track.offsetHeight, stage.offsetHeight);
      if (p > 0.005 && !landed) {
        // The visitor scrolled before the tigers stopped: skip to the end of act 1.
        if (Number.isFinite(video.duration)) video.currentTime = video.duration;
        video.pause();
        land();
      }
      const out = phase(p, HERO_PHASES.hintOut);
      if (hint) hint.style.opacity = landed ? String(1 - out) : "";
      if (brand) {
        const b = phase(p, HERO_PHASES.brandIn);
        // Written by hand as the models arrive (owner, 2026-11-22): visible at once, the
        // pen (--write) carries the rest.
        brand.style.opacity = String(Math.min(1, b * 4));
        brand.style.setProperty("--write", String(b));
      }
      const tf = phase(p, HERO_PHASES.transform);
      frames.style.opacity = p > 0.005 || failed ? "1" : "0";
      player.show(tf);
      camera(p);
      scenes(p);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const onResize = () => {
      geo = null;
      onScroll();
    };

    const FIRST_INPUT = ["scroll", "pointerdown", "keydown"] as const;
    for (const type of FIRST_INPUT) {
      window.addEventListener(type, sampleBackdrop, { once: true, passive: true });
    }

    let timer = 0;
    let raf = 0;
    let deferred = 0;
    if (reduce) {
      track.dataset.mode = "static";
      video.pause();
      stage.classList.add("is-revealed");
      landed = true;
      frames.style.opacity = "1";
      startFrames();
      player.show(1);
    } else {
      track.dataset.mode = "motion";
      video.addEventListener("ended", land);
      video.addEventListener("error", onError);
      video.muted = true;
      // The film is requested only after the first frame with the headline is painted
      // (one frame, then a task): fetched with the page it took the phone's bandwidth from
      // the scripts and fonts the first screen waits for (#62). The poster is the same
      // plain backdrop the film starts on, so nothing visible changes while it loads.
      const begin = () => {
        video.src = pickHeroVideo(media, (type) => video.canPlayType(type));
        if (landed) {
          // Scrolled before the film began: hold its last frame (the tigers standing).
          const toEnd = () => {
            if (Number.isFinite(video.duration)) video.currentTime = video.duration;
          };
          video.addEventListener("loadedmetadata", toEnd, { once: true });
          video.load();
          return;
        }
        video.play()?.catch(fallback);
        // Still on its first frame after the timeout: it is not going to play.
        timer = window.setTimeout(
          () => (video.currentTime > 0 ? land() : fallback()),
          REVEAL_TIMEOUT,
        );
      };
      raf = requestAnimationFrame(() => {
        raf = 0;
        deferred = window.setTimeout(begin, 0);
      });
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      // First draw on the next frame, not inside hydration: render() reads layout, and a
      // read here forced an extra full layout on the phone's busiest task (#62).
      onScroll();
    }

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(deferred);
      if (raf) cancelAnimationFrame(raf);
      if (idle) {
        if (typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
        else window.clearTimeout(idle);
      }
      for (const type of FIRST_INPUT) window.removeEventListener(type, sampleBackdrop);
      video.removeEventListener("ended", land);
      video.removeEventListener("error", onError);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
      player.stop();
    };
  }, []);

  return (
    <section ref={trackRef} aria-label={label} data-hero data-mode="pending" className="hero-track">
      <div className="hero">
        <div className="hero-media" role="img" aria-label={scene}>
          <video
            ref={videoRef}
            className="hero-video"
            muted
            playsInline
            preload="none"
            poster={HERO_POSTER}
            disablePictureInPicture
          />
          {/* No <source> in the markup: the effect sets the cut that fits the screen after
              the first paint, and never under reduced motion (the final frame is shown). */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a frame sequence, src swapped per scroll step */}
          <img ref={framesRef} className="hero-frames" alt="" aria-hidden decoding="sync" />
        </div>
        {children}
      </div>
    </section>
  );
}
