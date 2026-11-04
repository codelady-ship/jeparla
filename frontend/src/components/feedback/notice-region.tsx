"use client";

import { X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { notices } from "@/lib/notice";

const DISMISS_MS = 7000;
const none = () => null;

/** Bottom toast for short notices; the live region stays mounted so it is announced. */
export function NoticeRegion({ closeLabel }: { closeLabel: string }) {
  const notice = useSyncExternalStore(notices.subscribe, notices.get, none);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => notices.dismiss(notice.id), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      {notice && (
        <div className="pointer-events-auto flex max-w-md items-start gap-3 rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-lg">
          <div className="flex flex-col gap-2">
            <p>{notice.text}</p>
            {notice.action && (
              <Link
                href={notice.action.href}
                onClick={() => notices.dismiss()}
                className="self-start link-underline font-medium"
              >
                {notice.action.label}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => notices.dismiss()}
            aria-label={closeLabel}
            className="-m-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-muted"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
