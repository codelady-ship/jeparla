"use client";

import { useEffect } from "react";
import { rememberReferral, reportVisit, sourceFrom } from "@/lib/referral";

/**
 * Counts a visit that came through a shared store link (#100): only when the address has
 * `ref` or `utm_source`, once per tab, sent from the browser. Renders nothing.
 */
export function StoreVisit({ slug }: { slug: string }) {
  useEffect(() => {
    const source = sourceFrom(window.location.search);
    if (!source) return;
    const referral = { slug, source };
    if (rememberReferral(referral)) reportVisit(referral);
  }, [slug]);
  return null;
}
