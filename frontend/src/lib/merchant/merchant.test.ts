import { beforeEach, describe, expect, it } from "vitest";
import { merchantApi, isNewDemoSeller } from "@/lib/api/merchant";
import { mockRoleFor } from "@/lib/auth/server";
import type { MerchantProductRow } from "@/types/merchant";
import { EMPTY_INPUT, firstOpenStep, productDraft } from "./draft";
import { filterRows, toggledStatus } from "./filter";
import { formatWeek, invalidDays, parseWeek } from "./hours";
import { move } from "./images";
import { metalStep, pathErrors, productSubmit, profileSchema, stonesStep } from "./schemas";

const merchant = { name: "Demo", email: "merchant@example.az", role: "MERCHANT" as const };
const fresh = { name: "Yeni", email: "merchant+new@example.az", role: "MERCHANT" as const };

describe("opening hours", () => {
  it("round-trips grouped schema.org rules", () => {
    const s = "Mo-Fr 10:00-19:00; Sa 11:00-17:00";
    expect(formatWeek(parseWeek(s))).toBe(s);
  });
  it("splits a range when one day changes and skips closed days", () => {
    const week = parseWeek("Mo-Sa 10:00-20:00");
    week[2] = { open: true, from: "12:00", to: "20:00" };
    week[5] = { ...week[5], open: false };
    expect(formatWeek(week)).toBe("Mo-Tu 10:00-20:00; We 12:00-20:00; Th-Fr 10:00-20:00");
  });
  it("flags days that close before they open", () => {
    const week = parseWeek("Mo 10:00-09:00; Tu 10:00-18:00");
    expect(invalidDays(week)).toEqual([0]);
  });
});

describe("product list", () => {
  const row = (id: number, az: string, status: MerchantProductRow["status"]) =>
    ({ id, name: { az, en: az, ru: az }, status }) as MerchantProductRow;
  const rows = [row(1, "Qızıl üzük", "APPROVED"), row(2, "Gümüş sırğa", "DRAFT")];

  it("searches without Azerbaijani letters and filters by status", () => {
    expect(filterRows(rows, "qizil", "ALL").map((r) => r.id)).toEqual([1]);
    expect(filterRows(rows, "", "DRAFT").map((r) => r.id)).toEqual([2]);
    expect(filterRows(rows, "sirga", "APPROVED")).toEqual([]);
  });
  it("only toggles live and paused products", () => {
    expect(toggledStatus("APPROVED")).toBe("INACTIVE");
    expect(toggledStatus("INACTIVE")).toBe("APPROVED");
    expect(toggledStatus("IN_REVIEW")).toBeNull();
  });
  it("moves photos and keeps the list size", () => {
    expect(move(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(move(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});

describe("product schemas", () => {
  it("keeps weight and price as exact strings and reports the variant path", () => {
    const r = metalStep.safeParse({
      metal: "GOLD",
      fineness: "2",
      variants: [
        { key: "a", size: "", weightGrams: "3,25", price: "1248.50", stockStatus: "IN_STOCK" },
        { key: "b", size: "", weightGrams: "2", price: "1.005", stockStatus: "IN_STOCK" },
      ],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(pathErrors(r.error)).toEqual({ "variants.1.price": "decimalInvalid" });
  });
  it("checks stone type and count", () => {
    const r = stonesStep.safeParse({
      stones: [
        {
          key: "s",
          type: "",
          origin: "NATURAL",
          carat: "",
          count: "0",
          certificateLab: "",
          certificateNumber: "",
        },
      ],
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(pathErrors(r.error)).toEqual({
        "stones.0.type": "required",
        "stones.0.count": "countInvalid",
      });
  });
  it("needs a photo before anything is sent", () => {
    expect(productSubmit.safeParse({ intent: "DRAFT", product: EMPTY_INPUT }).success).toBe(false);
  });
  it("checks the profile phone and social link", () => {
    const r = profileSchema.safeParse({
      name: "Ayzer",
      whatsapp: "123",
      city: "Baki",
      address: "Nizami 10",
      social: "insta",
      description: "",
      openingHours: "",
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(pathErrors(r.error)).toEqual({ whatsapp: "phoneInvalid", social: "socialInvalid" });
  });
});

describe("product draft", () => {
  beforeEach(() => localStorage.clear());

  it("persists per key and survives a new read", () => {
    const d = productDraft("t1");
    d.clear();
    d.update((x) => ({ ...x, input: { ...x.input, name: "Üzük" }, done: [1] }));
    expect(JSON.parse(localStorage.getItem("jeparla-product-draft:t1") ?? "{}")).toMatchObject({
      input: { name: "Üzük" },
      done: [1],
    });
    expect(d.exists()).toBe(true);
    expect(firstOpenStep(d.get().done)).toBe(2);
    d.clear();
    expect(d.exists()).toBe(false);
    expect(d.get().input.name).toBe("");
  });
  it("starts an edit draft from the product with the steps done", () => {
    const d = productDraft("t2", { ...EMPTY_INPUT, name: "Mövcud" });
    expect(d.get().input.name).toBe("Mövcud");
    expect(firstOpenStep(d.get().done)).toBe(5);
  });
});

describe("demo merchant", () => {
  it("maps demo addresses to roles", () => {
    expect(mockRoleFor("merchant@x.az")).toBe("MERCHANT");
    expect(mockRoleFor("merchant+new@x.az")).toBe("MERCHANT");
    expect(mockRoleFor("merchantx@x.az")).toBe("USER");
    expect(isNewDemoSeller(fresh)).toBe(true);
    expect(isNewDemoSeller({ ...fresh, email: "+994501234567" })).toBe(true);
    expect(isNewDemoSeller(merchant)).toBe(false);
  });
  it("gives the approved store every status and consistent counts", async () => {
    const api = merchantApi(merchant);
    const [store, stats, rows] = await Promise.all([api.store(), api.dashboard(), api.products()]);
    expect(store.sellerStatus).toBe("VERIFIED");
    expect(new Set(rows.map((r) => r.status))).toEqual(
      new Set(["DRAFT", "IN_REVIEW", "APPROVED", "RETURNED", "INACTIVE"]),
    );
    expect(Object.values(stats.counts).reduce((a, b) => a + b, 0)).toBe(rows.length);
    expect(stats.views).toBe(rows.reduce((a, r) => a + r.views, 0));
    const edit = await api.product(rows[0].id);
    expect(edit?.input.variants[0].price).toMatch(/^\d+\.\d{2}$/);
    expect(await api.product(123456)).toBeNull();
  });
  it("gives a new seller a pending, empty store", async () => {
    const api = merchantApi(fresh);
    expect((await api.store()).sellerStatus).toBe("PENDING");
    expect(await api.products()).toEqual([]);
  });
});
