import { SITE_URL } from "@/i18n/alternates";
import { buildLlmsTxt } from "@/lib/seo/llms";

// Plain-text guide for AI assistants (llmstxt.org): what Jeparla is and where things are.
export function GET() {
  return new Response(buildLlmsTxt(SITE_URL), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
