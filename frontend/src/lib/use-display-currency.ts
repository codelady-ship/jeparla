"use client";

import { useSyncExternalStore } from "react";
import type { DisplayCurrency } from "@/types/api";

export type CurrencyChoice = "AZN" | DisplayCurrency;

const KEY = "jeparla.currency";
const listeners = new Set<() => void>();

function read(): CurrencyChoice {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "USD" || saved === "EUR" ? saved : "AZN";
  } catch {
    return "AZN";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function choose(c: CurrencyChoice) {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    // storage blocked: nothing to remember, AZN stays
  }
  listeners.forEach((l) => l());
}

const serverSnapshot = (): CurrencyChoice => "AZN";

/** The buyer's display currency (#53): AZN on the server and during hydration, then the saved choice. */
export function useDisplayCurrency(): [CurrencyChoice, (c: CurrencyChoice) => void] {
  return [useSyncExternalStore(subscribe, read, serverSnapshot), choose];
}
