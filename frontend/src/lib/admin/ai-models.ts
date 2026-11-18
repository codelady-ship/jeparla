import { z } from "zod";
import type { AiModel, ModelAudience, ModelPose, ModelStyle, SkinTone } from "@/types/ai";

/**
 * AI model library forms (#130). The dialogs and the route handlers parse with the
 * same schemas as backend AiModelRequest and AiModelImageAttachRequest; messages are
 * keys under Admin.errors. The backend checks the ADMIN role and every value again.
 */

export const MODEL_AUDIENCES = ["WOMEN", "MEN", "KIDS"] as const satisfies readonly ModelAudience[];
export const SKIN_TONES = [
  "LIGHT",
  "MEDIUM_LIGHT",
  "MEDIUM",
  "MEDIUM_DARK",
  "DARK",
] as const satisfies readonly SkinTone[];
export const MODEL_STYLES = [
  "CLASSIC",
  "CASUAL",
  "EVENING",
  "MINIMAL",
] as const satisfies readonly ModelStyle[];
export const MODEL_POSES = [
  "HAND",
  "EAR",
  "NECK",
  "WRIST",
  "HALF_PORTRAIT",
] as const satisfies readonly ModelPose[];

/** Reference photos: the same types and size limit as product photos (backend checks the file). */
export const MODEL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MODEL_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

const text = (max: number) => z.string().trim().min(1, "required").max(max, "tooLong");

export const aiModelSchema = z.object({
  name: text(60),
  audience: z.enum(MODEL_AUDIENCES),
  skinTone: z.enum(SKIN_TONES),
  style: z.enum(MODEL_STYLES),
  origin: text(300),
  sortOrder: z.number("invalid").int("invalid").min(0, "invalid").max(10_000, "invalid"),
  active: z.boolean(),
});

export type AiModelInput = z.infer<typeof aiModelSchema>;

/** The editable fields of a model, for the edit dialog and for one-field changes. */
export function modelInput(model: AiModel): AiModelInput {
  return {
    name: model.name,
    audience: model.audience,
    skinTone: model.skinTone,
    style: model.style,
    origin: model.origin,
    sortOrder: model.sortOrder,
    active: model.active,
  };
}

export const emptyModelInput = (sortOrder: number): AiModelInput => ({
  name: "",
  audience: "WOMEN",
  skinTone: "MEDIUM",
  style: "CLASSIC",
  origin: "",
  sortOrder,
  active: true,
});

export const modelUploadSchema = z.object({
  contentType: z.enum(MODEL_IMAGE_TYPES, "invalid"),
  sizeBytes: z.number().int().positive().max(MODEL_IMAGE_MAX_BYTES, "invalid"),
});

export const modelAttachSchema = z.object({
  key: z.string().min(1).max(200),
  pose: z.enum(MODEL_POSES),
});

/** A file the backend would refuse before any upload starts: wrong type or too large. */
export function photoProblem(file: { type: string; size: number }): "type" | "size" | null {
  if (!(MODEL_IMAGE_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size <= 0 || file.size > MODEL_IMAGE_MAX_BYTES) return "size";
  return null;
}

/**
 * Library order as the backend keeps it: sort order, then id. A model that became the
 * default clears the flag of the other model of its audience (one default per audience).
 */
export function upsertModel(all: AiModel[], changed: AiModel): AiModel[] {
  const rest = all
    .filter((m) => m.id !== changed.id)
    .map((m) =>
      changed.isDefault && m.audience === changed.audience && m.isDefault
        ? { ...m, isDefault: false }
        : m,
    );
  return [...rest, changed].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}
