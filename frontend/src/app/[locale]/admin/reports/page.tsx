import { AdminPage, first } from "@/components/admin/admin-page";
import { AdminIntl, adminMetadata } from "@/components/admin/admin-shell";
import { ReportsList } from "@/components/admin/reports-list";
import { pickStatus, REPORT_FILTERS } from "@/lib/admin/filter";
import { adminContext } from "@/lib/admin/server";

export const generateMetadata = () => adminMetadata("reports");

type SP = PageProps<"/[locale]/admin/reports">["searchParams"];

async function List({ searchParams }: { searchParams: SP }) {
  const [{ api }, sp] = await Promise.all([adminContext(), searchParams]);
  const rows = await api.reports();
  return (
    <AdminIntl>
      <ReportsList
        rows={rows}
        initialQuery={first(sp.q)}
        initialStatus={pickStatus(first(sp.status), REPORT_FILTERS, "OPEN")}
      />
    </AdminIntl>
  );
}

export default function Page({ searchParams }: PageProps<"/[locale]/admin/reports">) {
  return (
    <AdminPage page="reports" sampleOnly>
      <List searchParams={searchParams} />
    </AdminPage>
  );
}
