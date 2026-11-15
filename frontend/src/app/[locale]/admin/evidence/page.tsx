import { getTranslations } from "next-intl/server";
import { AdminPage, first } from "@/components/admin/admin-page";
import { AdminIntl, adminMetadata } from "@/components/admin/admin-shell";
import { EvidenceList } from "@/components/admin/evidence-list";
import { Link } from "@/i18n/navigation";
import { EVIDENCE_STATUSES, pickEvidenceStatus } from "@/lib/admin/evidence";
import { evidencePhotos } from "@/lib/admin/evidence-server";
import { adminContext } from "@/lib/admin/server";
import { USING_MOCK } from "@/lib/api";
import { cn } from "cn";

export const generateMetadata = () => adminMetadata("evidence");

type SP = PageProps<"/[locale]/admin/evidence">["searchParams"];

async function List({ searchParams }: { searchParams: SP }) {
  const [, sp, t, ta] = await Promise.all([
    adminContext(),
    searchParams,
    getTranslations("Admin.evidence"),
    getTranslations("Admin"),
  ]);
  const status = pickEvidenceStatus(first(sp.status));
  if (USING_MOCK)
    return (
      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        {t("sampleOnly")}
      </p>
    );
  const rows = await evidencePhotos(status);
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={ta("statusLabel")}>
        <ul className="flex flex-wrap gap-2">
          {EVIDENCE_STATUSES.map((s) => (
            <li key={s}>
              <Link
                href={s === "PENDING" ? "/admin/evidence" : `/admin/evidence?status=${s}`}
                aria-current={s === status ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-lg border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  s === status
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted",
                )}
              >
                {t(`status.${s}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <AdminIntl>
        <EvidenceList key={status} rows={rows} />
      </AdminIntl>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/[locale]/admin/evidence">) {
  return (
    <AdminPage page="evidence">
      <List searchParams={searchParams} />
    </AdminPage>
  );
}
