"use client";

import { Bell, FileCheck, LayoutDashboard, Package, Store } from "lucide-react";
import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "cn";

const ITEMS = [
  { href: "/merchant", key: "dashboard", icon: LayoutDashboard },
  { href: "/merchant/products", key: "products", icon: Package },
  { href: "/merchant/profile", key: "profile", icon: Store },
  { href: "/merchant/documents", key: "documents", icon: FileCheck },
  { href: "/merchant/notifications", key: "notifications", icon: Bell },
] as const;

/** Section tabs; the current one carries aria-current="page". */
export function MerchantNav({
  label,
  labels,
  badges = {},
}: {
  label: string;
  labels: Record<(typeof ITEMS)[number]["key"], string>;
  /** Server-rendered extras after a label, e.g. the unread notification count. */
  badges?: Partial<Record<(typeof ITEMS)[number]["key"], ReactNode>>;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const current = href === "/merchant" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-11 items-center gap-2 border-b-2 px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  current
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {labels[key]}
                {badges[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
