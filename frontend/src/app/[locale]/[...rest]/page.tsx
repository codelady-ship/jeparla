import { notFound } from "next/navigation";

// Any path under /az, /en or /ru that matches no route lands here, so the 404 is
// [locale]/not-found.tsx: in the visitor's language, with the header and footer.
// No generateStaticParams and no sitemap entry: nothing here is a real page.
export default function UnknownPage(): never {
  notFound();
}
