import type { VideoCut } from "./ambient-video";

/**
 * Stock media of the home and stores pages (Pexels; authors and links in
 * docs/credits.md). Loops are 8 s boomerangs, muted, with no audio track; phone cuts
 * are cropped for portrait screens. All of it is decorative: never a listed store or
 * product.
 */
const cut = (dir: string, name: string, poster = `/media/${dir}/${name}.avif`): VideoCut => ({
  mp4: `/media/${dir}/${name}.mp4`,
  webm: `/media/${dir}/${name}.webm`,
  poster,
});

/** A jeweller's hands finishing a gold ring: the seller call to action. */
export const ATELIER_VIDEO = {
  desktop: cut("atelier", "desktop"),
  mobile: cut("atelier", "mobile"),
};

/** Close-up of a diamond ring held between the fingers: the "how we check" block. */
export const RING_VIDEO = { desktop: cut("ring", "desktop"), mobile: cut("ring", "mobile") };

/** Gold earrings in a showcase, a hand reaching toward them: the categories band. */
export const SHOWCASE_VIDEO = {
  desktop: cut("showcase", "desktop"),
  mobile: cut("showcase", "mobile"),
};

/**
 * A lit showcase of gold bracelets (slow pan): the stores banner on the home page and
 * the /stores header. The posters are stills of a store interior (a design
 * visualisation), shown first and instead of the video under reduced motion.
 */
export const VITRINE_HOME = {
  desktop: cut("vitrine", "desktop", "/media/showroom/wide.avif"),
  mobile: cut("vitrine", "mobile", "/media/showroom/phone.avif"),
};

export const VITRINE_STORES = {
  desktop: cut("vitrine", "desktop", "/media/showroom/counter.avif"),
  mobile: cut("vitrine", "small", "/media/showroom/counter-small.avif"),
};
