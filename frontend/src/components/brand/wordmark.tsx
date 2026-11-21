import { cn } from "@/lib/utils";
import { WORDMARK } from "./logo-paths";

/**
 * The Jeparla wordmark (logo option A, #50): Cormorant letters outlined to paths, the "l"
 * a baguette-cut stone in two gold faces. Letters take the text colour (currentColor), the
 * stone the gold tokens, so it follows the light and dark theme. The drawing is hidden
 * from assistive tech; the name is read from the visually hidden text beside it.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <>
      <svg
        viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
        aria-hidden="true"
        focusable="false"
        className={cn("block h-[1.7rem] w-auto", className)}
      >
        <path fill="currentColor" d={WORDMARK.letters} />
        <path className="fill-gold" d={WORDMARK.faceL} />
        <path className="fill-scene-gold-deep dark:fill-scene-gold-light" d={WORDMARK.faceR} />
      </svg>
      <span className="sr-only">Jeparla</span>
    </>
  );
}
