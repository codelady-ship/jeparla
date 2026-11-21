import { apiFetch, isNotFound } from "./http";
import { mockApi } from "./mock";

/**
 * Does a public product, store or category exist? Asked by the proxy before a detail page
 * renders: the page streams (Cache Components), so a notFound() inside it can only add a
 * noindex tag to a 200. Answering here gives crawlers and visitors a real 404.
 *
 * Answers are kept in memory for a few minutes per server instance (the proxy runs often;
 * the catalog changes rarely). When the backend cannot be asked, the page is let through
 * and shows its own error or 404 state: this check never turns an outage into a 404.
 */
export type DetailKind = "products" | "stores" | "categories" | "collections";

/** Kinds answered from a public list (no detail endpoint): the slug must be in it. */
const LISTED: DetailKind[] = ["categories", "collections"];

const TTL_FOUND = 5 * 60_000;
const TTL_MISSING = 60_000;
const MAX_ENTRIES = 2_000;
const memory = new Map<string, { exists: boolean; until: number }>();

async function ask(kind: DetailKind, slug: string, mock: boolean): Promise<boolean | null> {
  if (mock) {
    if (kind === "products") return (await mockApi.getProduct(slug)) !== null;
    if (kind === "stores") return (await mockApi.getStore(slug)) !== null;
    if (kind === "collections")
      return (await mockApi.listCollections()).some((c) => c.slug === slug);
    return (await mockApi.listCategories()).some((c) => c.slug === slug);
  }
  try {
    if (LISTED.includes(kind)) {
      const all = await apiFetch<{ slug: string }[]>(`/${kind}`, { timeoutMs: 3_000 });
      return all.some((c) => c.slug === slug);
    }
    await apiFetch(`/${kind}/${encodeURIComponent(slug)}`, { timeoutMs: 3_000 });
    return true;
  } catch (e) {
    return isNotFound(e) ? false : null;
  }
}

export async function detailExists(kind: DetailKind, slug: string, mock: boolean) {
  const key = `${kind}/${slug}`;
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && hit.until > now) return hit.exists;
  const exists = await ask(kind, slug, mock);
  if (exists === null) return true;
  if (memory.size >= MAX_ENTRIES) memory.clear();
  memory.set(key, { exists, until: now + (exists ? TTL_FOUND : TTL_MISSING) });
  return exists;
}
