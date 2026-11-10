import { AdminPage, first } from "@/components/admin/admin-page";
import { AdminIntl, adminMetadata } from "@/components/admin/admin-shell";
import { UsersList } from "@/components/admin/users-list";
import { pickStatus, USER_FILTERS } from "@/lib/admin/filter";
import { adminContext } from "@/lib/admin/server";

export const generateMetadata = () => adminMetadata("users");

type SP = PageProps<"/[locale]/admin/users">["searchParams"];

async function List({ searchParams }: { searchParams: SP }) {
  const [{ api }, sp] = await Promise.all([adminContext(), searchParams]);
  const rows = await api.users();
  return (
    <AdminIntl>
      <UsersList
        rows={rows}
        initialQuery={first(sp.q)}
        initialStatus={pickStatus(first(sp.status), USER_FILTERS, "ALL")}
      />
    </AdminIntl>
  );
}

export default function Page({ searchParams }: PageProps<"/[locale]/admin/users">) {
  return (
    <AdminPage page="users" sampleOnly>
      <List searchParams={searchParams} />
    </AdminPage>
  );
}
