import { locales } from "@/i18n/routing";
import { serviceWorkerSource } from "@/lib/pwa/service-worker";

/**
 * The service worker, served from the site root so its scope is the whole site.
 * JEPARLA_BUILD changes with every build (next.config.ts), so browsers pick up updates.
 */
export function GET() {
  const source = serviceWorkerSource({ version: process.env.JEPARLA_BUILD ?? "dev", locales });
  return new Response(source, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
