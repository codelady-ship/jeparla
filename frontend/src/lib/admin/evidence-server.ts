import { USING_MOCK } from "@/lib/api/mode";
import { mockEvidenceQueue } from "@/lib/api/mock";
import { userFetch } from "@/lib/auth/backend";
import type { Page } from "@/types/api";
import type { AdminEvidencePhoto, EvidenceStatus } from "./evidence";

/**
 * GET /admin/evidence-photos?status= (server components), oldest first. With the sample
 * data: the hallmark and label photos of the demo catalog (product 13).
 */
export async function evidencePhotos(status: EvidenceStatus): Promise<AdminEvidencePhoto[]> {
  if (USING_MOCK) return mockEvidenceQueue(status);
  const page = await userFetch<Page<AdminEvidencePhoto>>("/admin/evidence-photos", {
    query: { status, size: 50 },
  });
  return page.content;
}
