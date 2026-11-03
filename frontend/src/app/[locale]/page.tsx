import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import type { Locale } from "@/i18n/routing";
import { HomeContent } from "@/components/home/home-content";

// Placeholder home page. Real sections come with issue #15, header with #5.
export default function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  return <HomeContent />;
}
