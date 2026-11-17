import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

/** The one filled action of a home section: a gold pill. */
export const PRIMARY_PILL = cn(
  buttonVariants({ variant: "gold", size: "lg" }),
  "h-11 rounded-full px-6",
);

/** Secondary action on a light ground: an outline pill. */
export const GHOST_PILL = cn(
  buttonVariants({ variant: "outline", size: "lg" }),
  "h-11 gap-1.5 rounded-full bg-transparent px-5 dark:bg-transparent",
);

/** Secondary action on deep green: an ivory outline pill. */
export const GHOST_PILL_DARK =
  "inline-flex h-11 items-center gap-1.5 rounded-full border border-scene-ivory/70 px-5 text-sm font-medium text-scene-ivory transition-colors duration-200 hover:bg-scene-ivory/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scene-gold";
