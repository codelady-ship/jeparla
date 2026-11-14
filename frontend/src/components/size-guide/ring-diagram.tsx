/**
 * A ring seen from above: the band, its inner diameter (straight arrow) and its inner
 * circumference (inner edge). Drawn here, no external image; colours come from tokens.
 */
export function RingDiagram({
  title,
  desc,
  diameter,
  circumference,
}: {
  title: string;
  desc: string;
  diameter: string;
  circumference: string;
}) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-labelledby="ring-diagram-title ring-diagram-desc"
        className="w-full max-w-56 text-foreground"
      >
        <title id="ring-diagram-title">{title}</title>
        <desc id="ring-diagram-desc">{desc}</desc>
        <defs>
          <marker
            id="ring-diagram-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 10 5 0 10z" className="fill-foreground" />
          </marker>
        </defs>
        {/* Band: the ring between outer and inner edge. */}
        <circle cx="100" cy="100" r="78" className="fill-none stroke-gold" strokeWidth="16" />
        {/* Inner circumference. */}
        <circle
          cx="100"
          cy="100"
          r="70"
          className="fill-none stroke-gold-text"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        {/* Inner diameter. */}
        <line
          x1="32"
          y1="100"
          x2="168"
          y2="100"
          className="stroke-foreground"
          strokeWidth="2"
          markerStart="url(#ring-diagram-arrow)"
          markerEnd="url(#ring-diagram-arrow)"
        />
        <text x="100" y="92" textAnchor="middle" className="fill-foreground text-[13px]">
          {diameter}
        </text>
        <text x="100" y="130" textAnchor="middle" className="fill-gold-text text-[13px]">
          {circumference}
        </text>
      </svg>
      <figcaption className="text-center text-xs text-muted-foreground">{title}</figcaption>
    </figure>
  );
}
