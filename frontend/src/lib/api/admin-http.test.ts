import { describe, expect, it } from "vitest";
import { CHECK_ACTIONS, nextStatus } from "@/lib/admin/decisions";
import { CHECK_OF, toAdminStore, toAuditEntry, toVerification } from "./admin-http";

describe("admin API mapping", () => {
  it("makes every uploaded document its own request, with its product", () => {
    const row = toVerification({
      id: "0b6c3c1e-8a4e-4c55-9a43-1c0e6b0d2f11",
      storeId: 4,
      storeName: "Store",
      productId: 12,
      productName: "Ring",
      checkKind: "EXPERTISE",
      kind: "LAB_REPORT",
      fileName: "report.pdf",
      status: "CHANGES_REQUESTED",
      rejectReason: "UNREADABLE",
      reviewNote: "Scan again",
      createdAt: "2026-11-09T10:00:00Z",
    });
    expect(row.id).toBe("0b6c3c1e-8a4e-4c55-9a43-1c0e6b0d2f11");
    expect(row.check).toBe("expertise");
    expect(row.product).toEqual({ id: 12, name: "Ring" });
    expect(row.documents).toEqual([
      { id: row.id, kind: "LAB_REPORT", fileName: "report.pdf", pages: null },
    ]);
    // A returned document waits for a new upload: no decision buttons on it.
    expect(row.status).toBe("REJECTED");
    expect(CHECK_ACTIONS[row.status]).toEqual([]);
  });

  it("offers decisions only while a document is pending", () => {
    expect(CHECK_OF.PENDING).toBe("PENDING");
    expect(nextStatus("check", "PENDING", "reject")).toBe("REJECTED");
    expect(nextStatus("check", "VERIFIED", "reject")).toBeNull();
  });

  it("does not invent counts the API does not send", () => {
    const store = toAdminStore({
      id: 1,
      slug: "s",
      name: "S",
      city: "Bakı",
      status: "PENDING",
      statusNote: null,
      ownerName: "Owner",
      ownerContact: null,
      createdAt: "2026-11-01T00:00:00Z",
    });
    expect(store.productCount).toBeNull();
    expect(store.phone).toBe("");
  });

  it("keeps the backend action code in the audit log", () => {
    const entry = toAuditEntry({
      id: 7,
      actorLabel: "admin@example.com",
      action: "DOCUMENT_APPROVED",
      targetType: "DOCUMENT",
      targetName: null,
      targetId: "abc",
      reason: null,
      createdAt: "2026-11-09T10:00:00Z",
    });
    expect(entry).toMatchObject({
      action: "DOCUMENT_APPROVED",
      target: "DOCUMENT",
      targetName: "abc",
    });
  });
});
