"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * The playing part of the product video (#117), loaded only after the buyer pressed play (it is
 * a chunk of its own, so the product page ships no player code and requests no video bytes
 * before that). Muted, with the browser's controls; the space bar, Enter and K play or pause.
 * It loops, except for a visitor who asked for reduced motion: there it plays once and stops.
 */
export function VideoPlayer({
  url,
  contentType,
  label,
  active,
  onPlaying,
}: {
  url: string;
  contentType: string;
  label: string;
  /** False when its carousel slide is not the shown one: the video pauses. */
  active: boolean;
  onPlaying?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [loop] = useState(
    () =>
      typeof window.matchMedia !== "function" ||
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // Mounted by the click on "play": start, and take the focus so the keyboard works at once.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.focus({ preventScroll: true });
    void video.play()?.catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) ref.current?.pause();
  }, [active]);

  function onKeyDown(e: KeyboardEvent<HTMLVideoElement>) {
    if (e.key !== " " && e.key !== "Enter" && e.key.toLowerCase() !== "k") return;
    // The browser's own shortcut would toggle a second time.
    e.preventDefault();
    const video = e.currentTarget;
    if (video.paused) void video.play()?.catch(() => {});
    else video.pause();
  }

  return (
    <video
      ref={ref}
      // A hidden carousel frame must hold nothing the Tab key can reach.
      tabIndex={active ? 0 : -1}
      controls
      muted
      loop={loop}
      playsInline
      preload="none"
      aria-label={label}
      onKeyDown={onKeyDown}
      onPlaying={onPlaying}
      className="absolute inset-0 z-10 size-full object-contain outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <source src={url} type={contentType} />
    </video>
  );
}
