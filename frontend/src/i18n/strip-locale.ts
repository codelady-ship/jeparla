import { locales } from "./routing";

const PREFIX = new RegExp(`^/(${locales.join("|")})(?=/|$)`);

/** "/az/products/ring" + "?x=1" -> "/products/ring?x=1" (path without the locale prefix). */
export function stripLocale(pathname: string, search = ""): string {
  return (pathname.replace(PREFIX, "") || "/") + search;
}
