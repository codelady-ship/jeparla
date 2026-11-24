import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import type { FitState } from "./image-fit";
import { ImageUpload } from "./image-upload";

const runs: Array<(s: FitState) => void> = [];
vi.mock("./image-fit", async (importActual) => ({
  ...(await importActual<typeof import("./image-fit")>()),
  runFit: vi.fn(() => new Promise<FitState>((resolve) => runs.push(resolve))),
}));

const F = en.Merchant.imageFit;
const PIXEL = "data:image/png;base64,iVBORw0KGgo=";
const name = en.Merchant.form.images.position.replace("{n}", "1");

function renderUpload(url: string) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ImageUpload images={[{ id: "a", url, name: "ring.jpg" }]} onChange={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

/** Generous waits: the first render of the form is slow on a loaded CI runner. */
const WAIT = { timeout: 5000 };

const done = (url: string): FitState => ({ state: "done", url, blob: new Blob([]) });

beforeEach(() => {
  runs.length = 0;
  // A plain stand-in, not an undici Response: on Node 22 wrapping a jsdom Blob in a
  // Response can make .blob() reject, so the fit would never reach runFit.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ blob: async () => new Blob(["x"]) })),
  );
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe("ImageUpload: fit to design (#327)", () => {
  it("offers the fit only for photos picked in the form, not for saved ones", () => {
    renderUpload("https://images.example.com/stores/1/ring.webp");
    expect(screen.queryByRole("button", { name: F.actionFor.replace("{name}", name) })).toBeNull();
  });

  it("drops the result of an older run and frees its blob URL", async () => {
    renderUpload(PIXEL);
    const action = () => screen.getByRole("button", { name: F.actionFor.replace("{name}", name) });

    fireEvent.click(action());
    await vi.waitFor(() => expect(runs).toHaveLength(1), WAIT);
    // Closed while the first run is still working, then opened again.
    const dialog = await screen.findByRole("dialog", {}, WAIT);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    fireEvent.click(action());
    await vi.waitFor(() => expect(runs).toHaveLength(2), WAIT);

    await act(async () => runs[0](done("blob:old")));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:old");
    expect(screen.queryByAltText(F.afterAlt.replace("{name}", name))).toBeNull();
    expect(screen.getByText(F.working)).toBeInTheDocument();

    await act(async () => runs[1](done("blob:new")));
    expect(screen.getByAltText(F.afterAlt.replace("{name}", name))).toHaveAttribute(
      "src",
      "blob:new",
    );
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:new");
  });
});
