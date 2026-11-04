/**
 * One short message at a time (for example "compare is full"), shown by
 * <NoticeRegion> in a polite live region. Plain module store, no context needed.
 */
export type Notice = { id: number; text: string; action?: { href: string; label: string } };

let current: Notice | null = null;
let seq = 0;
const listeners = new Set<() => void>();

export const notices = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get: () => current,
  show(text: string, action?: Notice["action"]) {
    current = { id: ++seq, text, action };
    listeners.forEach((l) => l());
  },
  dismiss(id?: number) {
    if (id !== undefined && current?.id !== id) return;
    current = null;
    listeners.forEach((l) => l());
  },
};
