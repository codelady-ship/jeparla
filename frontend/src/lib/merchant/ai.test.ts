import { describe, expect, it } from "vitest";
import az from "../../../messages/az.json";
import { aiStudioApi, NOT_CONFIGURED } from "@/lib/api/ai";
import { AI_ERROR_CODES } from "@/types/ai";
import { aiErrorCode, aiJobAction, aiJobRequest, isRunning, quotaLeft } from "./ai";

const session = { name: "Satıcı", email: "merchant@example.az", role: "MERCHANT" as const };

describe("AI Studio (#55)", () => {
  it("is not configured and shows no jobs while no provider is connected", async () => {
    const api = aiStudioApi(session);
    await expect(api.status()).resolves.toEqual(NOT_CONFIGURED);
    expect(NOT_CONFIGURED.configured).toBe(false);
    await expect(api.jobs(1)).resolves.toEqual([]);
    // The model library (#130) is empty until the admin uploads models: no sample models.
    await expect(api.models("WOMEN")).resolves.toEqual([]);
  });

  it("validates job requests and actions", () => {
    expect(
      aiJobRequest.safeParse({ productId: 1, sourceImageId: 5, kind: "AI_PHOTOSHOOT" }).success,
    ).toBe(true);
    expect(aiJobRequest.safeParse({ productId: 1, sourceImageId: 5, kind: "OTHER" }).success).toBe(
      false,
    );
    expect(
      aiJobRequest.safeParse({ productId: 1, sourceImageId: 5, kind: "VIRTUAL_TRY_ON", modelId: 2 })
        .success,
    ).toBe(true);
    expect(aiJobAction.safeParse({ action: "approve" }).success).toBe(false);
    expect(aiJobAction.safeParse({ action: "approve", assetId: 3 }).success).toBe(true);
  });

  it("maps only known error codes, each with a message", () => {
    expect(aiErrorCode("ai.cost_limit")).toBe("ai.cost_limit");
    expect(aiErrorCode("provider said: quota")).toBeNull();
    expect(aiErrorCode(undefined)).toBeNull();
    const messages = az.Merchant.ai.errors.ai as Record<string, string>;
    for (const code of AI_ERROR_CODES) expect(messages[code.slice(3)]).toBeTruthy();
  });

  it("counts quota and running jobs", () => {
    expect(quotaLeft(10, 3)).toBe(7);
    expect(quotaLeft(10, 12)).toBe(0);
    expect(isRunning("QUEUED")).toBe(true);
    expect(isRunning("REVIEW_REQUIRED")).toBe(false);
  });
});
