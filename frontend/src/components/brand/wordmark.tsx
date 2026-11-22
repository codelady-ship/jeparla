import { cn } from "@/lib/utils";
import { WORDMARK } from "./logo-paths";

/**
 * The Jeparla wordmark (script logo, owner's choice 2026-11-22): Great Vibes letters
 * outlined to paths, a ring threaded on the head of the "J" (the far half of the band
 * behind the stroke, the near half and its stone in front). Letters take the text colour
 * (currentColor), the ring the gold tokens, so it follows the light and dark theme. The
 * drawing is hidden from assistive tech; the name is read from the visually hidden text.
 */
export function Wordmark({ className }: { className?: string }) {
  const { ring } = WORDMARK;
  return (
    <>
      <svg
        viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
        aria-hidden="true"
        focusable="false"
        className={cn("block h-10 w-auto", className)}
      >
        <path
          className="fill-none stroke-scene-gold-deep dark:stroke-gold"
          strokeWidth={ring.stroke}
          strokeLinecap="round"
          d={ring.back}
        />
        <path fill="currentColor" d={WORDMARK.letters} />
        <path
          className="fill-none stroke-gold dark:stroke-scene-gold-light"
          strokeWidth={ring.stroke}
          strokeLinecap="round"
          d={ring.front}
        />
        <path
          className="fill-scene-gold-light stroke-scene-gold-deep"
          strokeWidth={ring.stoneStroke}
          strokeLinejoin="round"
          d={ring.stone}
        />
      </svg>
      <span className="sr-only">Jeparla</span>
    </>
  );
}
