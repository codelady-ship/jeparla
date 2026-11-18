import { AdminPage } from "@/components/admin/admin-page";
import { AdminIntl, adminMetadata } from "@/components/admin/admin-shell";
import { AiModelList } from "@/components/admin/ai-model-list";
import { adminAiModelsApi } from "@/lib/api/ai";
import { adminContext } from "@/lib/admin/server";

export const generateMetadata = () => adminMetadata("aiModels");

async function List() {
  const { session } = await adminContext();
  const models = await adminAiModelsApi(session).list();
  return (
    <AdminIntl>
      <AiModelList models={models} />
    </AdminIntl>
  );
}

export default function Page() {
  return (
    <AdminPage page="aiModels">
      <List />
    </AdminPage>
  );
}
