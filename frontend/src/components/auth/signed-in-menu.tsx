"use client";

import { Menu } from "@base-ui/react/menu";
import { Heart, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { signOut } from "@/lib/auth/actions";
import { homeFor, type Session } from "@/lib/auth/session";
import { cn } from "cn";
import type { AccountLabels } from "./account-menu";

const item =
  "flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm outline-none select-none data-highlighted:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground";

/** Loaded only for signed-in visitors, so guests do not download the menu code. */
export default function SignedInMenu({
  session,
  labels,
}: {
  session: Session;
  labels: AccountLabels;
}) {
  const router = useRouter();
  const icon = buttonVariants({ variant: "ghost", size: "icon" });
  const home = homeFor(session.role);
  return (
    <Menu.Root>
      <Menu.Trigger className={cn(icon, "rounded-full")} aria-label={labels.account}>
        <span
          aria-hidden
          className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground uppercase"
        >
          {session.name.slice(0, 1)}
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className="min-w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
            <div className="px-2 py-2">
              <p className="truncate text-sm font-medium">{session.name}</p>
              <p className="truncate text-xs text-muted-foreground">{session.email}</p>
            </div>
            <Menu.Separator className="my-1 h-px bg-border" />
            {home !== "/" && (
              <Menu.LinkItem render={<Link href={home} />} className={item}>
                <LayoutDashboard aria-hidden />
                {labels.dashboard}
              </Menu.LinkItem>
            )}
            <Menu.LinkItem render={<Link href="/favorites" />} className={item}>
              <Heart aria-hidden />
              {labels.favorites}
            </Menu.LinkItem>
            <Menu.LinkItem render={<Link href="/account" />} className={item}>
              <UserRound aria-hidden />
              {labels.myAccount}
            </Menu.LinkItem>
            <Menu.Item
              className={item}
              onClick={async () => {
                await signOut();
                router.replace("/");
              }}
            >
              <LogOut aria-hidden />
              {labels.logout}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
