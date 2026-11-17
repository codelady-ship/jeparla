import { ChevronDown } from "lucide-react";
import { cn } from "cn";

export type FaqItem = { q: string; a: string };

/**
 * Questions that open on click: a question row with a chevron, the answer below it.
 * Native <details>/<summary>, so it needs no JavaScript, works with the keyboard and
 * screen readers, and the answers stay in the HTML for search engines and the
 * FAQPage JSON-LD on the same page.
 */
export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("flex flex-col divide-y border-y", className)}>
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-4 font-semibold transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <ChevronDown
              aria-hidden
              className="size-5 shrink-0 text-gold-text transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <p className="pr-9 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
