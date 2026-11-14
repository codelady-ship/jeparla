import { ArrowLeft, PlugZap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { aiStudioApi } from "@/lib/api/ai";
import { merchantContext } from "@/lib/merchant/server";
import { AiStudio } from "./ai-studio";
import { MerchantIntl } from "./merchant-shell";

/**
 * Server part of /merchant/products/[id]/ai-studio (#55): the seller's product
 * (ownership: the API returns only own products), the provider status and the jobs.
 */
export async function AiStudioPage({ id }: { id: string }) {
  const { session, api } = await merchantContext();
  const productId = Number(id);
  const product = Number.isInteger(productId) ? await api.product(productId) : null;
  if (!product) notFound();
  const ai = aiStudioApi(session);
  const [status, jobs, models, t] = await Promise.all([
    ai.status(),
    ai.jobs(productId),
    ai.models({ productId }),
    getTranslations("Merchant.ai"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/merchant/products/${productId}/edit`}
        className={buttonVariants({ variant: "ghost", size: "lg", className: "self-start" })}
      >
        <ArrowLeft aria-hidden />
        {t("back", { name: product.input.name })}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      {!status.configured && !status.studioLook && (
        <div
          role="status"
          className="flex gap-3 rounded-lg border border-gold/50 bg-muted p-4 text-sm"
        >
          <PlugZap aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-text" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{t("notConfigured.title")}</p>
            <p className="text-muted-foreground">{t("notConfigured.text")}</p>
          </div>
        </div>
      )}
      <ul
        id="ai-rules"
        className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground"
      >
        <li>{t("rules.original")}</li>
        <li>{t("rules.approval")}</li>
        <li>{t("rules.badge")}</li>
        <li>{t("rules.studioLook")}</li>
      </ul>
      <MerchantIntl>
        <AiStudio
          productId={productId}
          status={status}
          images={product.input.images.map((img) => ({ id: String(img.id), url: img.url }))}
          jobs={jobs}
          models={models}
        />
      </MerchantIntl>
    </div>
  );
}

export function AiStudioSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
