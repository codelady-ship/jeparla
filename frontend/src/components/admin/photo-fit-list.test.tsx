import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { runFit, type FitState } from "@/components/merchant/image-fit";
import { fittedName, PhotoFitList } from "./photo-fit-list";

const runs: Array<(s: FitState) => void> = [];
vi.mock("@/components/merchant/image-fit", async (importActual) => ({
  ...(await importActual<typeof import("@/components/merchant/image-fit")>()),
  runFit: vi.fn(() => new Promise<FitState>((resolve) => runs.push(resolve))),
}));

const P = en.Admin.photos;
const removeName = (file: string) => P.remove.replace("{name}", file);

function renderList() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PhotoFitList />
    </NextIntlClientProvider>,
  );
}

function pick(...names: string[]) {
  const files = names.map((n) => new File(["x"], n, { type: "image/jpeg" }));
  fireEvent.change(screen.getByLabelText(P.choose), { target: { files } });
}

const done = (url: string): FitState => ({ state: "done", url, blob: new Blob([]) });

beforeEach(() => {
  runs.length = 0;
  vi.mocked(runFit).mockClear();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:original-${++n}`);
  URL.revokeObjectURL = vi.fn();
});

describe("fitted photo file name", () => {
  it("keeps the name and marks the fitted file", () => {
    expect(fittedName("ring-gold-2.jpg", "image/webp")).toBe("ring-gold-2-fit.webp");
    expect(fittedName("IMG_0001.HEIC.png", "image/jpeg")).toBe("IMG_0001.HEIC-fit.jpg");
    expect(fittedName(".png", "image/webp")).toBe("photo-fit.webp");
  });
});

describe("PhotoFitList queue (#327)", () => {
  it("lets a queued photo be removed, so it is never fitted", async () => {
    renderList();
    pick("a.jpg", "b.jpg");
    await vi.waitFor(() => expect(runs).toHaveLength(1));

    expect(screen.getByRole("button", { name: removeName("a.jpg") })).toBeDisabled();
    const queued = screen.getByRole("button", { name: removeName("b.jpg") });
    expect(queued).toBeEnabled();
    fireEvent.click(queued);
    expect(screen.queryByText("b.jpg")).toBeNull();

    await act(async () => runs[0](done("blob:fit-a")));
    expect(runFit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: removeName("a.jpg") })).toBeEnabled();
  });

  it("stops the queue when the page is left and frees the late result", async () => {
    const { unmount } = renderList();
    pick("a.jpg", "b.jpg");
    await vi.waitFor(() => expect(runs).toHaveLength(1));

    unmount();
    await act(async () => runs[0](done("blob:fit-a")));
    expect(runFit).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fit-a");
  });
});
