import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { CategoryTiles } from "@/components/categories/category-tiles";
import { alternates } from "@/i18n/alternates";
import { routing } from "@/i18n/routing";
import { api } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  "use cache";
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Categories" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: alternates(locale, "/categories"),
  };
}

export default async function CategoriesPage() {
  const [t, categories] = await Promise.all([getTranslations("Categories"), api.listCategories()]);
  const roots = categories.filter((c) => c.parentId === null);
  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="mb-2 text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="mb-8 max-w-2xl text-muted-foreground">{t("intro")}</p>
      <CategoryTiles categories={roots} />
    </div>
  );
}
