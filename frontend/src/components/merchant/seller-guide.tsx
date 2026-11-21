"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";
import { dismissGuide, isGuideDismissed } from "@/lib/merchant/guide";
import { storage } from "@/lib/pwa/install";

// The card (icons, copy, links) is its own chunk: a seller who closed the guide never loads it.
const SellerGuideCard = lazy(() => import("./seller-guide-card"));

// Closed in this page even when the browser refuses to remember it.
let closed = false;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const visible = () => !closed && !isGuideDismissed(storage("localStorage"));
const hidden = () => false;

/**
 * First-visit guide of the seller cabinet (#176): three steps, dismissible, and not shown
 * again once dismissed (remembered per browser, like the install card).
 */
export function SellerGuide() {
  const show = useSyncExternalStore(subscribe, visible, hidden);
  if (!show) return null;
  return (
    <Suspense fallback={null}>
      <SellerGuideCard
        onDismiss={() => {
          dismissGuide(storage("localStorage"));
          closed = true;
          // Focus inside the card would be lost when it unmounts: hand it to the page.
          document.getElementById("main")?.focus({ preventScroll: true });
          listeners.forEach((l) => l());
        }}
      />
    </Suspense>
  );
}
