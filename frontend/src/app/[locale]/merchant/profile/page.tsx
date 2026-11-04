import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MerchantIntl, merchantMetadata, StatusBadge } from "@/components/merchant/merchant-shell";
import { ProfileForm } from "@/components/merchant/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { merchantContext } from "@/lib/merchant/server";

export const generateMetadata = () => merchantMetadata("profile");

async function Profile() {
  const { api } = await merchantContext();
  const [store, t] = await Promise.all([api.store(), getTranslations("Merchant.profile")]);
  const verified = store.sellerStatus === "VERIFIED";
  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("status")}:</span>
        <StatusBadge
          status={
            verified ? "APPROVED" : store.sellerStatus === "REJECTED" ? "RETURNED" : "IN_REVIEW"
          }
          label={t(`sellerStatus.${store.sellerStatus}`)}
        />
      </p>
      <MerchantIntl>
        <ProfileForm
          initial={{
            name: store.name,
            whatsapp: store.whatsapp,
            city: store.city,
            address: store.address,
            social: store.social,
            description: store.description,
            openingHours: store.openingHours,
          }}
        />
      </MerchantIntl>
    </div>
  );
}

export default async function MerchantProfilePage() {
  const t = await getTranslations("Merchant.profile");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-[40rem] w-full rounded-lg" />}>
        <Profile />
      </Suspense>
    </div>
  );
}
