import { describe, expect, it } from "vitest";
import type { AiModel } from "@/types/ai";
import {
  aiModelSchema,
  emptyModelInput,
  modelInput,
  modelUploadSchema,
  photoProblem,
  upsertModel,
} from "./ai-models";

const model = (over: Partial<AiModel>): AiModel => ({
  id: 1,
  name: "Leyla",
  audience: "WOMEN",
  skinTone: "MEDIUM",
  style: "CLASSIC",
  origin: "Provider X, 2026-12-01",
  active: true,
  isDefault: false,
  sortOrder: 10,
  poses: [],
  images: [],
  ...over,
});

describe("aiModelSchema", () => {
  it("accepts the fields of backend AiModelRequest and trims text", () => {
    const parsed = aiModelSchema.parse({ ...modelInput(model({})), name: "  Leyla  " });
    expect(parsed.name).toBe("Leyla");
  });

  it("refuses an empty name or origin and a sort order out of range", () => {
    const result = aiModelSchema.safeParse({
      ...emptyModelInput(0),
      sortOrder: 10_001,
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => `${i.path.join(".")}:${i.message}`);
    expect(paths).toEqual(
      expect.arrayContaining(["name:required", "origin:required", "sortOrder:invalid"]),
    );
  });

  it("knows no UNISEX model: a model shows women, men or kids", () => {
    expect(aiModelSchema.safeParse({ ...modelInput(model({})), audience: "UNISEX" }).success).toBe(
      false,
    );
  });
});

describe("photo checks", () => {
  it("allows JPEG, PNG and WebP up to 15 MB", () => {
    expect(photoProblem({ type: "image/webp", size: 1000 })).toBeNull();
    expect(photoProblem({ type: "image/heic", size: 1000 })).toBe("type");
    expect(photoProblem({ type: "image/jpeg", size: 16 * 1024 * 1024 })).toBe("size");
    expect(modelUploadSchema.safeParse({ contentType: "image/gif", sizeBytes: 10 }).success).toBe(
      false,
    );
  });
});

describe("upsertModel", () => {
  it("keeps one default per audience and the backend order", () => {
    const all = [
      model({ id: 1, isDefault: true, sortOrder: 10 }),
      model({ id: 2, sortOrder: 20 }),
      model({ id: 3, audience: "MEN", isDefault: true, sortOrder: 5 }),
    ];
    const next = upsertModel(all, model({ id: 2, isDefault: true, sortOrder: 1 }));
    expect(next.map((m) => m.id)).toEqual([2, 3, 1]);
    expect(next.find((m) => m.id === 1)?.isDefault).toBe(false);
    expect(next.find((m) => m.id === 3)?.isDefault).toBe(true);
  });

  it("adds a new model at its place", () => {
    const next = upsertModel([model({ id: 1 })], model({ id: 9, sortOrder: 0 }));
    expect(next.map((m) => m.id)).toEqual([9, 1]);
  });
});
