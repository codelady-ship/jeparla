import { serializeJsonLd } from "@/lib/seo/json-ld";

/** Renders schema.org data into the initial HTML (server only, no JS shipped). */
export function JsonLd({ data }: { data: Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Serialized and escaped by serializeJsonLd; content is our own data, not user HTML.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
