import { SearchPage, searchMetadata } from "@/components/search/search-page";

export const generateMetadata = () => searchMetadata("stores");

export default function Page({ searchParams }: PageProps<"/[locale]/search/stores">) {
  return <SearchPage tab="stores" searchParams={searchParams} />;
}
