"use client";

import { UserRound } from "lucide-react";
import { lazy, Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/lib/auth/client";

export type AccountLabels = {
  login: string;
  account: string;
  dashboard: string;
  favorites: string;
  myAccount: string;
  logout: string;
};

const SignedInMenu = lazy(() => import("./signed-in-menu"));

/** Guest: link to /login. Signed in: menu with the role's home and sign-out. */
export function AccountMenu({ labels }: { labels: AccountLabels }) {
  const state = useSession();
  const icon = buttonVariants({ variant: "ghost", size: "icon" });
  const session = state.status === "ready" ? state.session : null;
  const login = (
    <Link href="/login" prefetch={false} className={icon} aria-label={labels.login}>
      <UserRound aria-hidden />
    </Link>
  );
  if (!session) return login;
  return (
    <Suspense fallback={login}>
      <SignedInMenu session={session} labels={labels} />
    </Suspense>
  );
}
