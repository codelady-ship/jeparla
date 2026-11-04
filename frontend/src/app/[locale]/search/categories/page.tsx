import { SearchPage, searchMetadata } from "@/components/search/search-page";

export const generateMetadata = () => searchMetadata("categories");

export default function Page({ searchParams }: PageProps<"/[locale]/search/categories">) {
  return <SearchPage tab="categories" searchParams={searchParams} />;
}
