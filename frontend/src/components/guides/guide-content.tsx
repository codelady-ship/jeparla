import { ArrowRight, ExternalLink } from "lucide-react";
import type { GuideBlock, GuideLink, GuideSection, GuideSource } from "@/content/guides/types";
import { Link } from "@/i18n/navigation";
import { isExternal } from "@/lib/guides";

const linkClass =
  "inline-flex items-center gap-1.5 font-medium text-gold-text underline underline-offset-4 hover:text-foreground pointer-coarse:py-2";

/** One link inside a guide: internal paths stay in the current language, external ones open a new tab. */
export function GuideAnchor({ link, externalLabel }: { link: GuideLink; externalLabel: string }) {
  if (isExternal(link.href)) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {link.label}
        <ExternalLink aria-hidden className="size-3.5 shrink-0" />
        <span className="sr-only">({externalLabel})</span>
      </a>
    );
  }
  return (
    <Link href={link.href} className={linkClass}>
      {link.label}
      <ArrowRight aria-hidden className="size-3.5 shrink-0" />
    </Link>
  );
}

function Block({ block, externalLabel }: { block: GuideBlock; externalLabel: string }) {
  switch (block.type) {
    case "p":
      return <p>{block.text}</p>;
    case "ul":
      return (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-gold-text">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 marker:text-gold-text">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "links":
      return (
        <ul className="flex flex-col gap-1">
          {block.items.map((link) => (
            <li key={link.href}>
              <GuideAnchor link={link} externalLabel={externalLabel} />
            </li>
          ))}
        </ul>
      );
  }
}

/** The sections of a guide, each with a heading the table of contents links to. */
export function GuideSections({
  sections,
  externalLabel,
}: {
  sections: GuideSection[];
  externalLabel: string;
}) {
  return (
    <div className="flex flex-col gap-10">
      {sections.map((s) => (
        <section key={s.id} aria-labelledby={s.id} className="flex flex-col gap-3">
          <h2 id={s.id} className="scroll-mt-24 text-2xl sm:text-3xl">
            {s.title}
          </h2>
          <div className="flex flex-col gap-3 leading-relaxed">
            {s.blocks.map((b, i) => (
              <Block key={i} block={b} externalLabel={externalLabel} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Numbered list of sources with the publisher; every entry links to the page itself. */
export function GuideSources({
  sources,
  title,
  note,
  externalLabel,
}: {
  sources: GuideSource[];
  title: string;
  note: string;
  externalLabel: string;
}) {
  return (
    <section aria-labelledby="sources" className="flex flex-col gap-3 border-t pt-8">
      <h2 id="sources" className="scroll-mt-24 text-2xl">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{note}</p>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm marker:text-muted-foreground">
        {sources.map((s) => (
          <li key={s.url} className="break-words">
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-4 hover:text-gold-text"
            >
              {s.title}
              <span className="sr-only"> ({externalLabel})</span>
            </a>
            <span className="text-muted-foreground">. {s.publisher}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
