"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

export type VideoCut = {
  /** H.264 MP4, the fallback every browser plays. */
  mp4: string;
  /** AV1 WebM, smaller; listed first so browsers that play it pick it. */
  webm?: string;
  /** First frame of the loop (AVIF), shown until the video plays and instead of it. */
  poster: string;
};

type Props = {
  desktop: VideoCut;
  mobile: VideoCut;
  /** Media query that picks the desktop cut. */
  desktopQuery?: string;
  /** Above the fold (/stores header): the poster loads at once with high priority. */
  eager?: boolean;
  /**
   * Labels for a pause / play button (WCAG 2.2.2) on full-width bands. The button is
   * only shown where the video may play at all (not under reduced motion or Save-Data).
   */
  controls?: { pause: string; play: string };
  className?: string;
};

/** Start fetching a little before the block scrolls in, so the first frame is ready. */
const ARM_MARGIN = "300px 0px";

/** With the codec named, browsers that read WebM but not AV1 (older Safari) take the MP4. */
const AV1 = 'video/webm; codecs="av01.0.05M.08"';

/**
 * Muted background loop for a section (seller call to action, ring close-up, stores
 * banners). Nothing but a lazy poster is requested until the block comes near the
 * viewport: the <video> has no sources and preload="none" until then. It plays only
 * while on screen and pauses when it leaves. Reduced motion, Save-Data or no
 * IntersectionObserver: the poster stays and the video is never requested.
 * Decorative: hidden from assistive technology; the section carries the meaning.
 */
export function AmbientVideo({
  desktop,
  mobile,
  desktopQuery = "(min-width: 48rem)",
  eager,
  controls,
  className,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false);
  /** The visitor paused it: scrolling back into view does not restart it. */
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData;
    if (reduce || saveData) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setArmed(true);
          io.disconnect();
        }
      },
      { rootMargin: ARM_MARGIN },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!armed || !root || !video) return;
    video.muted = true;
    video.load();
    const shown = () => video.setAttribute("data-playing", "");
    video.addEventListener("playing", shown);

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible && !pausedRef.current) video.play()?.catch(() => {});
        else video.pause();
      },
      { threshold: 0.2 },
    );
    io.observe(root);
    return () => {
      io.disconnect();
      video.removeEventListener("playing", shown);
      video.pause();
    };
  }, [armed]);

  const toggle = () => {
    const video = videoRef.current;
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (!video) return;
    if (next) video.pause();
    else {
      video.play()?.catch(() => {});
    }
  };

  const media = (
    <div ref={rootRef} aria-hidden className={cn("ambient-video", className)}>
      <picture>
        <source media={desktopQuery} srcSet={desktop.poster} type="image/avif" />
        <img
          src={mobile.poster}
          alt=""
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding="async"
        />
      </picture>
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
      >
        {armed && (
          <>
            {desktop.webm && <source src={desktop.webm} type={AV1} media={desktopQuery} />}
            <source src={desktop.mp4} type="video/mp4" media={desktopQuery} />
            {mobile.webm && <source src={mobile.webm} type={AV1} />}
            <source src={mobile.mp4} type="video/mp4" />
          </>
        )}
      </video>
    </div>
  );
  if (!controls) return media;
  return (
    <>
      {media}
      {armed && (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={paused}
          aria-label={paused ? controls.play : controls.pause}
          className="ambient-toggle"
        >
          {paused ? (
            <Play aria-hidden className="size-4" />
          ) : (
            <Pause aria-hidden className="size-4" />
          )}
        </button>
      )}
    </>
  );
}
