import { Suspense } from "react";
import { AiStudioPage, AiStudioSkeleton } from "@/components/merchant/ai-studio-page";
import { merchantMetadata } from "@/components/merchant/merchant-shell";

// Private and per user: one sample id lets the build prerender the static shell;
// the studio itself reads the session and always renders on request.
export function generateStaticParams() {
  return [{ id: "0" }];
}

export const generateMetadata = () => merchantMetadata("aiStudio");

async function Studio({
  params,
}: {
  params: PageProps<"/[locale]/merchant/products/[id]/ai-studio">["params"];
}) {
  const { id } = await params;
  return <AiStudioPage id={id} />;
}

export default function AiStudioRoute({
  params,
}: PageProps<"/[locale]/merchant/products/[id]/ai-studio">) {
  return (
    <Suspense fallback={<AiStudioSkeleton />}>
      <Studio params={params} />
    </Suspense>
  );
}
