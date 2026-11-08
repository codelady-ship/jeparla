"use client";

import { LayoutDashboard, PackageCheck, ShieldCheck, Store } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "cn";

const ITEMS = [
  { href: "/admin", key: "overview", icon: LayoutDashboard },
  { href: "/admin/stores", key: "stores", icon: Store },
  { href: "/admin/products", key: "products", icon: PackageCheck },
  { href: "/admin/verification", key: "checks", icon: ShieldCheck },
] as const;

export type AdminNavKey = (typeof ITEMS)[number]["key"];

/** Section tabs; the current one carries aria-current="page". */
export function AdminNav({
  label,
  labels,
}: {
  label: string;
  labels: Record<AdminNavKey, string>;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const current = href === "/admin" ? pathname === href : pathname.startsWith(href);
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
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
