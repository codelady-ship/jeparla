import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AiModel } from "@/types/ai";
import az from "../../../messages/az.json";
import en from "../../../messages/en.json";
import ru from "../../../messages/ru.json";
import { modelFits, TryOnModelPicker } from "./try-on-model-picker";

const t = az.Merchant.form.tryOn;

const model = (id: number, audience: AiModel["audience"]): AiModel => ({
  id,
  name: `Model ${id}`,
  audience,
  skinTone: "MEDIUM",
  style: "CLASSIC",
  origin: "test",
  active: true,
  isDefault: false,
  sortOrder: id,
  poses: ["HAND"],
  images: [{ id: id * 10, url: `/m${id}.jpg`, pose: "HAND", width: 800, height: 1000 }],
});

const MODELS = [model(1, "WOMEN"), model(2, "MEN"), model(3, "KIDS")];

const renderIn = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="az" messages={az} timeZone="Asia/Baku">
      {ui}
    </NextIntlClientProvider>,
  );

describe("modelFits (#121), as the backend AudienceRules.fits", () => {
  it("puts a kids piece only on a child and a unisex piece on any adult", () => {
    expect(modelFits("KIDS", "KIDS")).toBe(true);
    expect(modelFits("KIDS", "WOMEN")).toBe(false);
    expect(modelFits("UNISEX", "KIDS")).toBe(false);
    expect(modelFits("UNISEX", "WOMEN")).toBe(true);
    expect(modelFits("UNISEX", "MEN")).toBe(true);
    expect(modelFits("WOMEN", "MEN")).toBe(false);
    expect(modelFits("MEN", "MEN")).toBe(true);
  });
});

describe("TryOnModelPicker (#315)", () => {
  it("offers only fitting models plus no model, and reports the pick", () => {
    const onChange = vi.fn();
    renderIn(
      <TryOnModelPicker models={MODELS} audience="WOMEN" value={null} onChange={onChange} />,
    );
    const group = screen.getByRole("group", { name: t.legend });
    expect(group).toHaveAccessibleDescription(t.hint);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByRole("radio", { name: t.none })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Model 1" }));
    expect(onChange).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("radio", { name: "Model 2" })).toBeNull();
  });

  it("treats a pick that no longer fits as no model", () => {
    renderIn(<TryOnModelPicker models={MODELS} audience="KIDS" value={1} onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: t.none })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Model 3" })).not.toBeChecked();
  });

  it("shows nothing without a fitting model", () => {
    const { container } = renderIn(
      <TryOnModelPicker
        models={[model(2, "MEN")]}
        audience="WOMEN"
        value={null}
        onChange={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("has every text in az, en and ru", () => {
    for (const m of [az, en, ru]) {
      const o = m.Merchant.form.tryOn;
      expect(o.legend && o.hint && o.none).toBeTruthy();
    }
  });
});
