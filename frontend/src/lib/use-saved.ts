"use client";

import { useSyncExternalStore } from "react";
import type { SavedList } from "@/lib/saved-list";

const NONE: readonly number[] = [];
const serverSnapshot = () => NONE;

/** Ids in a saved list; empty on the server and during hydration. */
export function useSavedIds(list: SavedList): readonly number[] {
  return useSyncExternalStore(list.subscribe, list.get, serverSnapshot);
}
