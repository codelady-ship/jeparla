import { USING_MOCK } from "@/lib/api/mode";
import { userFetch } from "@/lib/auth/backend";
import type { Page } from "@/types/api";
import type { AdminEvidencePhoto, EvidenceStatus } from "./evidence";

/**
 * GET /admin/evidence-photos?status= (server components), oldest first. None with the
 * sample data: the demo catalog has no seller photos of hallmarks or labels.
 */
export async function evidencePhotos(status: EvidenceStatus): Promise<AdminEvidencePhoto[]> {
  if (USING_MOCK) return [];
  const page = await userFetch<Page<AdminEvidencePhoto>>("/admin/evidence-photos", {
    query: { status, size: 50 },
  });
  return page.content;
}
