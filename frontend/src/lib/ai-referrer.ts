/**
 * Visits from an AI assistant's answer, counted as a separate source (#62, PLAN 5.18). The
 * proxy looks at a full page load's `Referer` and `utm_source` (ChatGPT adds
 * `utm_source=chatgpt.com` to its links) and, when they name an assistant, reports the visit
 * to the backend from the server: no script in the page, no cookie, nothing stored about the
 * visitor. The backend (az.jeparla.analytics.AiSource) decides which assistant it was, leaves
 * out bots and reloads, and keeps only daily counters per assistant and kind of page. This
 * host list only decides whether to make the call at all; keep it in step with AiSource.
 */

/** Hosts of AI assistants; a subdomain counts too (www., m.). */
export const AI_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "bard.google.com",
  "copilot.microsoft.com",
  "copilot.cloud.microsoft",
  "claude.ai",
  "chat.deepseek.com",
  "deepseek.com",
  "grok.com",
  "meta.ai",
  "chat.mistral.ai",
  "alice.yandex.ru",
] as const;

/** utm_source words of AI assistants that are not a host. */
const AI_NAMES = new Set([
  "chatgpt",
  "openai",
  "perplexity",
  "gemini",
  "bard",
  "copilot",
  "claude",
  "deepseek",
  "grok",
  "metaai",
  "mistral",
  "lechat",
  "alice",
  "yandexgpt",
]);

/** Longest value the backend looks at (AiSource.MAX_LENGTH). */
const MAX = 256;

function hostOf(value: string): string {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isAiHost(host: string): boolean {
  return AI_HOSTS.some((listed) => host === listed || host.endsWith(`.${listed}`));
}

/**
 * The value to report when the visit came from an AI assistant: the referrer when it is one,
 * otherwise an assistant's `utm_source`; null for every other visit.
 */
export function aiSource(referer: string | null, params: URLSearchParams): string | null {
  if (referer && referer.length <= MAX && isAiHost(hostOf(referer))) return referer;
  const utm = params.get("utm_source")?.trim().toLowerCase() ?? "";
  if (!utm || utm.length > MAX) return null;
  return isAiHost(hostOf(utm)) || AI_NAMES.has(utm) ? utm : null;
}

export type LandingPage = "home" | "product" | "store" | "category" | "prices" | "guide" | "other";

/** Kind of page from the path after the language (`/products/x` -> product). */
export function landingPage(rest: string): LandingPage {
  const first = rest.split("/").filter(Boolean)[0] ?? "";
  switch (first) {
    case "":
      return "home";
    case "products":
      return "product";
    case "stores":
      return "store";
    case "categories":
      return "category";
    case "prices":
      return "prices";
    case "guides":
      return "guide";
    default:
      return "other";
  }
}

/** The backend call for one AI visit: POST /api/v1/visits/ai?source=&page=. */
export function aiVisitUrl(apiBase: string, source: string, page: LandingPage): string {
  const query = new URLSearchParams({ source, page });
  return `${apiBase}/api/v1/visits/ai?${query.toString()}`;
}
