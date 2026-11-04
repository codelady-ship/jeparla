import { SearchPage, searchMetadata } from "@/components/search/search-page";

export const generateMetadata = () => searchMetadata("all");

export default function Page({ searchParams }: PageProps<"/[locale]/search">) {
  return <SearchPage tab="all" searchParams={searchParams} />;
}
