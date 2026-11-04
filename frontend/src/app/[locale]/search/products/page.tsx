import { SearchPage, searchMetadata } from "@/components/search/search-page";

export const generateMetadata = () => searchMetadata("products");

export default function Page({ searchParams }: PageProps<"/[locale]/search/products">) {
  return <SearchPage tab="products" searchParams={searchParams} />;
}
