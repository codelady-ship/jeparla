import type { MetadataRoute } from "next";
import { SITE_URL } from "@/i18n/alternates";

/**
 * Search and AI answer engines are explicitly welcome (GEO, issue #61), so Jeparla can
 * appear in Google, Bing and in ChatGPT, Claude, Perplexity and Gemini answers.
 * Private areas stay closed for everyone.
 */
export const AI_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
] as const;

export const PRIVATE_PATHS = ["/api/", "/*/merchant", "/*/admin", "/*/design"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: [...AI_BOTS, "Googlebot", "Bingbot"], allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
