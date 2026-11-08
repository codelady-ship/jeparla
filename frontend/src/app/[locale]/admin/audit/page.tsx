import { AdminPage, first } from "@/components/admin/admin-page";
import { AdminIntl, adminMetadata } from "@/components/admin/admin-shell";
import { AuditList } from "@/components/admin/audit-list";
import { AUDIT_FILTERS, pickStatus } from "@/lib/admin/filter";
import { adminContext } from "@/lib/admin/server";

export const generateMetadata = () => adminMetadata("audit");

type SP = PageProps<"/[locale]/admin/audit">["searchParams"];

async function List({ searchParams }: { searchParams: SP }) {
  const [{ api }, sp] = await Promise.all([adminContext(), searchParams]);
  const rows = await api.audit();
  return (
    <AdminIntl>
      <AuditList
        rows={rows}
        initialQuery={first(sp.q)}
        initialStatus={pickStatus(first(sp.status), AUDIT_FILTERS, "ALL")}
      />
    </AdminIntl>
  );
}

export default function Page({ searchParams }: PageProps<"/[locale]/admin/audit">) {
  return (
    <AdminPage page="audit">
      <List searchParams={searchParams} />
    </AdminPage>
  );
}
