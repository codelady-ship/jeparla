import { describe, expect, it } from "vitest";
import { adminApi } from "@/lib/api/admin";
import { decisionSchema, nextStatus, REASON_MIN } from "./decisions";
import { filterList, pickStatus, shortDate, STORE_FILTERS } from "./filter";

describe("nextStatus", () => {
  it("follows the store lifecycle", () => {
    expect(nextStatus("store", "PENDING", "approve")).toBe("APPROVED");
    expect(nextStatus("store", "PENDING", "reject")).toBe("REJECTED");
    expect(nextStatus("store", "APPROVED", "block")).toBe("BLOCKED");
    expect(nextStatus("store", "BLOCKED", "unblock")).toBe("APPROVED");
    expect(nextStatus("store", "REJECTED", "approve")).toBe("APPROVED");
  });

  it("refuses stale or forged decisions", () => {
    expect(nextStatus("store", "APPROVED", "approve")).toBeNull();
    expect(nextStatus("store", "PENDING", "block")).toBeNull();
    expect(nextStatus("product", "DRAFT", "approve")).toBeNull();
    expect(nextStatus("product", "IN_REVIEW", "deactivate")).toBeNull();
    expect(nextStatus("check", "VERIFIED", "verify")).toBeNull();
    expect(nextStatus("store", "PENDING", "__proto__")).toBeNull();
  });

  it("moderates products and checks", () => {
    expect(nextStatus("product", "IN_REVIEW", "approve")).toBe("APPROVED");
    expect(nextStatus("product", "IN_REVIEW", "return")).toBe("RETURNED");
    expect(nextStatus("product", "APPROVED", "deactivate")).toBe("INACTIVE");
    expect(nextStatus("check", "PENDING", "verify")).toBe("VERIFIED");
    expect(nextStatus("check", "PENDING", "return")).toBe("REJECTED");
  });
});

describe("decisionSchema", () => {
  it("needs a reason for decisions the seller must understand", () => {
    for (const action of ["reject", "block", "return", "deactivate"]) {
      const r = decisionSchema.safeParse({ action, reason: "  kısa " });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.message).toBe("reasonRequired");
    }
    const ok = decisionSchema.safeParse({ action: "block", reason: "ə".repeat(REASON_MIN) });
    expect(ok.success).toBe(true);
  });

  it("approves without a reason and caps long ones", () => {
    expect(decisionSchema.safeParse({ action: "approve" }).success).toBe(true);
    const long = decisionSchema.safeParse({ action: "reject", reason: "x".repeat(501) });
    expect(long.error?.issues[0]?.message).toBe("reasonTooLong");
  });
});

describe("filterList", () => {
  const rows = [
    { status: "PENDING", name: "Günəş Zərgər" },
    { status: "APPROVED", name: "Lalə Atelye" },
  ];
  const text = (r: (typeof rows)[number]) => r.name;

  it("filters by status and folds Azerbaijani letters", () => {
    expect(filterList(rows, "gunes", "ALL", text)).toHaveLength(1);
    expect(filterList(rows, "", "APPROVED", text)[0].name).toBe("Lalə Atelye");
    expect(filterList(rows, "lale", "PENDING", text)).toHaveLength(0);
  });

  it("reads ?status= safely and formats dates", () => {
    expect(pickStatus("BLOCKED", STORE_FILTERS, "ALL")).toBe("BLOCKED");
    expect(pickStatus("<script>", STORE_FILTERS, "ALL")).toBe("ALL");
    expect(shortDate("2026-11-06T12:30:00+04:00")).toBe("06.11.2026");
  });
});

describe("demo admin data", () => {
  it("has work waiting in every queue", async () => {
    const o = await adminApi.overview();
    expect(o.pendingStores).toBeGreaterThan(0);
    expect(o.productsInReview).toBeGreaterThan(0);
    expect(o.pendingChecks).toBeGreaterThan(0);
    const products = await adminApi.products();
    expect(products[0].status).toBe("IN_REVIEW");
    expect(await adminApi.store(9999)).toBeNull();
  });
});
