import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AmbientVideo, type VideoCut } from "@/components/media/ambient-video";
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
 */
export async function VideoBand({ id, title, text, cta, video, note, after }: Props) {
  const t = await getTranslations("Home.video");
  return (
    <section aria-labelledby={id}>
      <div className="video-band relative isolate flex items-end overflow-hidden bg-scene-green text-scene-ivory">
        <AmbientVideo
          desktop={video.desktop}
          mobile={video.mobile}
          controls={{ pause: t("pause"), play: t("play") }}
        />
        <div aria-hidden className="band-scrim absolute inset-0" />
        <div className="home-wrap relative pt-24 pb-20 md:pb-16">
          <div className="flex max-w-2xl flex-col items-start gap-5">
            <h2 id={id} className="home-head text-4xl text-balance sm:text-6xl lg:text-7xl">
              {title}
            </h2>
            <p className="max-w-md text-pretty sm:text-lg">{text}</p>
            <Link href={cta.href} prefetch={false} className={cn(PRIMARY_PILL, "mt-1 h-12")}>
              {cta.label}
            </Link>
            {note && <p className="text-xs text-scene-ivory-muted">{note}</p>}
          </div>
        </div>
      </div>
      {after}
    </section>
  );
}
