/**
 * Slugs to prerender at build time. With Cache Components `generateStaticParams` must return
 * at least one entry, but a new production catalog can be empty (no approved stores yet).
 * Then one placeholder that matches nothing is prerendered as the 404 page; every real slug
 * still renders on its first request and is cached afterwards.
 */
export const NO_SLUG = "-";

export function slugParams(slugs: string[]): { slug: string }[] {
  return (slugs.length ? slugs : [NO_SLUG]).map((slug) => ({ slug }));
}
