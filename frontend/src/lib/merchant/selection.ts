/**
 * Which drafts a bulk action of the products table works on (#109). The seller may tick drafts;
 * then only the ticked drafts that are still in view are sent. With nothing ticked the action
 * works on every draft in view, as before.
 */
export function bulkTargets<T extends { id: number }>(
  drafts: readonly T[],
  selected: ReadonlySet<number>,
): { rows: T[]; selection: boolean } {
  const picked = drafts.filter((d) => selected.has(d.id));
  return picked.length > 0
    ? { rows: picked, selection: true }
    : { rows: [...drafts], selection: false };
}

/** The set with `id` added or removed. */
export function toggled(selected: ReadonlySet<number>, id: number, on: boolean): Set<number> {
  const next = new Set(selected);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

/** True when every id is in the set (and there is at least one). */
export function allSelected(selected: ReadonlySet<number>, ids: readonly number[]): boolean {
  return ids.length > 0 && ids.every((id) => selected.has(id));
}
