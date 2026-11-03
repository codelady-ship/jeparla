import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

// Generic skeleton for route transitions; pages add their own shaped skeletons.
export default function Loading() {
  const t = useTranslations("Errors");
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6"
    >
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-[4/5] w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
