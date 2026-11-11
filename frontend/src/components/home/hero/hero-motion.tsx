"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { FramePlayer } from "@/lib/motion/frames";
import { trackProgress } from "@/lib/motion/scrub";
import {
  HERO_DESKTOP_QUERY,
  HERO_FRAMES,
  HERO_MEDIA,
  HERO_POSTER,
  HERO_PHASES,
  frameUrl,
  phase,
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
 *   play() and after a timeout.
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
    const player = new FramePlayer(frames, {
      count: HERO_FRAMES,
      url: (i) => frameUrl(media.frames, i),
    });

    let started = false;
    let landed = false;
    let frame = 0;

    const sampleBackdrop = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        const ctx = c.getContext("2d", { willReadFrequently: true });
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
        brand.style.opacity = String(b);
        brand.style.transform = `translateY(${(1 - b) * 0.75}rem)`;
      }
      const tf = phase(p, HERO_PHASES.transform);
      frames.style.opacity = p > 0.005 ? "1" : "0";
      player.show(tf);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    video.addEventListener("loadeddata", sampleBackdrop);
    if (video.readyState >= 2) sampleBackdrop();

    let timer = 0;
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
      video.addEventListener("error", land);
      video.muted = true;
      video.play()?.catch(land);
      timer = window.setTimeout(land, REVEAL_TIMEOUT);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      render();
    }

    return () => {
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", sampleBackdrop);
      video.removeEventListener("ended", land);
      video.removeEventListener("error", land);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
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
            autoPlay
            playsInline
            preload="auto"
            poster={HERO_POSTER}
            disablePictureInPicture
          >
            <source src={HERO_MEDIA.desktop.video} type="video/mp4" media={HERO_DESKTOP_QUERY} />
            <source src={HERO_MEDIA.mobile.video} type="video/mp4" />
          </video>
          {/* eslint-disable-next-line @next/next/no-img-element -- a frame sequence, src swapped per scroll step */}
          <img ref={framesRef} className="hero-frames" alt="" aria-hidden decoding="sync" />
        </div>
        {children}
      </div>
    </section>
  );
}
