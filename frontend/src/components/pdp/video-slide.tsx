"use client";

import { Play, Sparkles, Video } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

/** The clip of a product as the gallery shows it; `length` is already text ("0:08"). */
export type GalleryVideo = {
  url: string;
  contentType: string;
  aiGenerated: boolean;
  length: string;
};

export type VideoLabels = {
  badge: string;
  ai: string;
  play: string;
  label: string;
  /** Raw template with {n} and {total}. */
  position: string;
  loading: string;
};

const VideoPlayer = dynamic(() => import("./video-player").then((m) => m.VideoPlayer), {
  ssr: false,
});

/**
 * The video frame of the product gallery (#117): the cover photo as the poster and a play
 * button. Nothing of the video is requested until the buyer presses it; then the player chunk
 * and the file load and the clip plays muted. Nothing ever starts by itself, so reduced motion
 * and Save-Data need no special case here. An AI-made clip carries the AI label.
 */
export function VideoSlide({
  video,
  poster,
  showPoster = true,
  sizes,
  labels,
  active = true,
}: {
  video: GalleryVideo;
  /** The cover photo; null for a product without photos. */
  poster: { url: string } | null;
  /** False while a hidden carousel slide should not fetch its poster yet (#160). */
  showPoster?: boolean;
  sizes: string;
  labels: VideoLabels;
  active?: boolean;
}) {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="absolute inset-0 bg-muted">
      {poster && showPoster && (
        <Image
          src={poster.url}
          alt=""
          fill
          sizes={sizes}
          unoptimized={poster.url.endsWith(".svg")}
          className="object-cover"
        />
      )}
      {started ? (
        <>
          <VideoPlayer
            url={video.url}
            contentType={video.contentType}
            label={labels.label}
            active={active}
            onPlaying={() => setPlaying(true)}
          />
          <p className="sr-only" role="status" hidden={playing}>
            {labels.loading}
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setStarted(true)}
          aria-label={labels.play}
          tabIndex={active ? undefined : -1}
          className="group/play absolute inset-0 grid cursor-pointer place-items-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <span className="grid size-16 place-items-center rounded-full bg-background/90 text-foreground shadow-md transition-transform duration-(--duration-base) ease-(--ease-luxe) group-hover/play:scale-105 group-active/play:scale-95 motion-reduce:transition-none">
            <Play aria-hidden className="size-7 translate-x-0.5 fill-current" />
          </span>
        </button>
      )}
      {/* Outside the button: its name is the aria-label, not this visible text (WCAG 2.5.3). */}
      <div className="pointer-events-none absolute top-3 left-3 z-20 flex flex-col items-start gap-1">
        <Badge variant="secondary">
          <Video aria-hidden />
          {labels.badge}
          <span className="tabular-nums">{video.length}</span>
        </Badge>
        {video.aiGenerated && (
          <Badge variant="secondary">
            <Sparkles aria-hidden />
            {labels.ai}
          </Badge>
        )}
      </div>
    </div>
  );
}
