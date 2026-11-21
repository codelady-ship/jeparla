import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AmbientVideo, type VideoCut } from "@/components/media/ambient-video";
import { Reveal } from "@/components/motion/reveal";
import { Link } from "@/i18n/navigation";
import { cn } from "cn";
import { PRIMARY_PILL } from "./pills";

type Props = {
  id: string;
  title: string;
  text: string;
  cta: { href: string; label: string };
  video: { desktop: VideoCut; mobile: VideoCut };
  /** Shown under the call to action: the footage is stock, not a listed store or item. */
  note?: string;
  /** Scrolls over the film after the copy (the three checks, the store cards). */
  after?: ReactNode;
};

/**
 * Home film section with the film pinned behind the content (#292). The film fills one
 * screen and stays put (`position: sticky`, CSS only) while the copy and then the cards
 * scroll up over it; at the end the next section scrolls over the still pinned film and
 * covers it (globals.css, .sticky-film). A deep green scrim keeps the ivory copy at AA
 * over any frame; cards sit on their own solid surfaces.
 * The film loads only near the viewport and plays only while on screen, with a pause
 * button (WCAG 2.2.2); reduced motion and Save-Data keep the poster.
 * The copy follows the scroll ([data-drift], globals.css): it comes in from the left as it
 * rises into view and fades away as it leaves at the top.
 * Motion: the film settles from 106% as the section scrolls in and the scrim deepens a
 * little once the content passes over it, tied to the scroll where the browser can
 * (animation-timeline), otherwise a one-off settle when the section comes in (<Reveal
 * from="film">). Transform and opacity only; none under reduced motion.
 */
export async function StickyVideoSection({ id, title, text, cta, video, note, after }: Props) {
  const t = await getTranslations("Home.video");
  return (
    <Reveal
      as="section"
      from="film"
      aria-labelledby={id}
      className="sticky-film"
      data-sticky-film=""
    >
      <div className="sticky-film-stage" data-sticky-film-stage="">
        <AmbientVideo
          desktop={video.desktop}
          mobile={video.mobile}
          controls={{ pause: t("pause"), play: t("play") }}
          className="bg-scene-green"
        />
        <div aria-hidden className="sticky-film-scrim" />
        <div aria-hidden className="sticky-film-shade" />
      </div>
      <div className="sticky-film-content">
        <div className="sticky-film-lead home-wrap">
          <Reveal stagger className="flex max-w-2xl flex-col items-start gap-5 text-scene-ivory">
            <h2
              id={id}
              className="home-head text-4xl text-balance sm:text-6xl lg:text-7xl"
              data-reveal-item=""
              data-drift="left"
            >
              {title}
            </h2>
            <p className="max-w-md text-pretty sm:text-lg" data-reveal-item="" data-drift="left">
              {text}
            </p>
            <div className="mt-1" data-reveal-item="" data-drift="left">
              <Link href={cta.href} prefetch={false} className={cn(PRIMARY_PILL, "h-12")}>
                {cta.label}
              </Link>
            </div>
            {note && (
              // Full ivory, not the muted tone: the scrim under it thins out to the right.
              <p
                className="max-w-md text-xs text-scene-ivory"
                data-reveal-item=""
                data-drift="left"
              >
                {note}
              </p>
            )}
          </Reveal>
        </div>
        {after}
      </div>
    </Reveal>
  );
}
