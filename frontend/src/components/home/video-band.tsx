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
  /** Rendered below the film inside the same section (for example a short list). */
  after?: ReactNode;
};

/**
 * Full-bleed film band of the home page: the loop fills the band edge to edge, a deep
 * green scrim rises from the bottom, the copy and one call to action sit bottom left
 * and a pause button bottom right (WCAG 2.2.2). The film loads only near the viewport,
 * plays only while on screen; reduced motion keeps the poster.
 * Motion (#287): the film opens from a slightly smaller window to full bleed as the band
 * scrolls in (globals.css, band-open), then the copy rises line by line.
 */
export async function VideoBand({ id, title, text, cta, video, note, after }: Props) {
  const t = await getTranslations("Home.video");
  return (
    <section aria-labelledby={id}>
      <Reveal
        from="film"
        className="video-band relative isolate flex items-end overflow-hidden text-scene-ivory"
      >
        <AmbientVideo
          desktop={video.desktop}
          mobile={video.mobile}
          controls={{ pause: t("pause"), play: t("play") }}
          className="bg-scene-green"
        />
        <div aria-hidden className="band-scrim absolute inset-0" />
        <div className="home-wrap relative pt-24 pb-20 md:pb-16">
          <Reveal stagger className="flex max-w-2xl flex-col items-start gap-5">
            <h2
              id={id}
              className="home-head text-4xl text-balance sm:text-6xl lg:text-7xl"
              data-reveal-item=""
            >
              {title}
            </h2>
            <p className="max-w-md text-pretty sm:text-lg" data-reveal-item="">
              {text}
            </p>
            <div className="mt-1" data-reveal-item="">
              <Link href={cta.href} prefetch={false} className={cn(PRIMARY_PILL, "h-12")}>
                {cta.label}
              </Link>
            </div>
            {note && (
              <p className="text-xs text-scene-ivory-muted" data-reveal-item="">
                {note}
              </p>
            )}
          </Reveal>
        </div>
      </Reveal>
      {after}
    </section>
  );
}
