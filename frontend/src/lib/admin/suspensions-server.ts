import { USING_MOCK } from "@/lib/api/mode";
import { userFetch } from "@/lib/auth/backend";
import type { Page } from "@/types/api";
import type { StoreSuspension, SuspensionStatus } from "./suspensions";

/** GET /admin/store-suspensions?status= (server components). None with the sample data. */
export async function storeSuspensions(status: SuspensionStatus): Promise<StoreSuspension[]> {
  if (USING_MOCK) return [];
  const page = await userFetch<Page<StoreSuspension>>("/admin/store-suspensions", {
    query: { status, size: 100 },
  });
  return page.content;
}
