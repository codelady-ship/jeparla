import { useMemo, type ComponentProps } from "react";
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

const nav = createNavigation(routing);

export const { redirect, usePathname, getPathname } = nav;

/**
 * Transition type of in-app navigations. The page cross-fade (<ViewTransition> in
 * the locale layout) runs only for transitions of this type (#160): React's
 * streaming runtime would otherwise animate every Suspense reveal of the first
 * load as a view transition, and the page's largest image would paint only after
 * that animation (late LCP on catalog pages).
 */
export const PAGE_TRANSITION = "page";
const types = [PAGE_TRANSITION];

/** next-intl's Link; its navigations cross-fade the page. */
export function Link(props: ComponentProps<typeof nav.Link>) {
  return <nav.Link transitionTypes={types} {...props} />;
}

type Router = ReturnType<typeof nav.useRouter>;

/** next-intl's router; push and replace cross-fade the page like a Link. */
export function useRouter(): Router {
  const router = nav.useRouter();
  return useMemo(
    () => ({
      ...router,
      push: (href, options) => router.push(href, { transitionTypes: types, ...options }),
      replace: (href, options) => router.replace(href, { transitionTypes: types, ...options }),
    }),
    [router],
  );
}
