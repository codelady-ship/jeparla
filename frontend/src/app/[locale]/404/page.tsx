import { notFound } from "next/navigation";

/**
 * Target of the proxy's rewrite for a product, store or category that does not exist
 * (src/proxy.ts): the site's own 404 page, in the visitor's language, with a 404 status.
 */
export default function MissingPage() {
  notFound();
}
