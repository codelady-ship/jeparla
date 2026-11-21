import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MerchantVideo } from "@/lib/merchant/video";
import az from "../../../messages/az.json";
import en from "../../../messages/en.json";
import ru from "../../../messages/ru.json";
import { VideoUpload } from "./video-upload";

const t = az.Merchant.form.video;

const stored: MerchantVideo = {
  url: "https://img.example/products/1/7/video/clip.mp4",
  contentType: "video/mp4",
  sizeBytes: 1_200_000,
  durationMs: 9400,
  width: 1080,
  height: 1920,
  aiGenerated: false,
};

const renderIn = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="az" messages={az} timeZone="Asia/Baku">
      {ui}
    </NextIntlClientProvider>,
  );

const file = (name: string, type: string, size = 1000) => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

const pick = (f: File) =>
  fireEvent.change(screen.getByLabelText(t.pick), { target: { files: [f] } });

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // jsdom reads no media: the browser "cannot tell" the length and the API decides.
  URL.createObjectURL = vi.fn(() => "blob:clip");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "src", "set").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    queueMicrotask(() => this.onerror?.(new Event("error")));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("VideoUpload", () => {
  it("asks to save a new product first and offers no file field", () => {
    renderIn(<VideoUpload productId={null} initial={null} listed={false} />);
    expect(screen.getByText(t.saveFirst)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.pick)).toBeNull();
  });

  it("refuses another type or a file over 8 MB before anything is sent", async () => {
    renderIn(<VideoUpload productId={7} initial={null} listed={false} />);
    pick(file("clip.mov", "video/quicktime"));
    expect(await screen.findByRole("alert")).toHaveTextContent("clip.mov");
    pick(file("long.mp4", "video/mp4", 8 * 1024 * 1024 + 1));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("long.mp4"));
    expect(screen.getByRole("alert")).toHaveTextContent("8 MB");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the file itself with its type and the AI mark, then shows the stored video", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...stored, aiGenerated: true }));
    renderIn(<VideoUpload productId={7} initial={null} listed />);
    fireEvent.click(screen.getByLabelText(t.aiLabel));
    const clip = file("clip.mp4", "video/mp4");
    pick(clip);
    expect(await screen.findByLabelText(t.preview)).toHaveAttribute("src", stored.url);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/merchant/products/7/video?ai=1",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "video/mp4" },
        body: clip,
      }),
    );
    expect(screen.getByText(t.aiBadge)).toBeInTheDocument();
    // A live product is reviewed again before buyers see the new video.
    expect(screen.getByRole("status")).toHaveTextContent(t.savedReview);
  });

  it("shows the refusal of the API in its own words", async () => {
    const refusal = "Video ən çox 15 saniyə ola bilər və müddəti faylda yazılmalıdır.";
    fetchMock.mockResolvedValue(Response.json({ errors: { form: refusal } }, { status: 400 }));
    renderIn(<VideoUpload productId={7} initial={null} listed={false} />);
    pick(file("clip.mp4", "video/mp4"));
    expect(await screen.findByRole("alert")).toHaveTextContent(refusal);
    expect(screen.queryByLabelText(t.preview)).toBeNull();
  });

  it("removes the stored video", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    renderIn(<VideoUpload productId={7} initial={stored} listed={false} />);
    // The seller's own preview loads only its first frame and never starts by itself.
    const preview = screen.getByLabelText<HTMLVideoElement>(t.preview);
    expect(preview).toHaveAttribute("preload", "metadata");
    expect(preview.autoplay).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: t.remove }));
    await waitFor(() => expect(screen.queryByLabelText(t.preview)).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith("/api/merchant/products/7/video", { method: "DELETE" });
    expect(screen.getByRole("status")).toHaveTextContent(t.removed);
  });
});

describe("video texts", () => {
  it("exist in az, en and ru for the seller form, the product page and the card", () => {
    for (const m of [az, en, ru]) {
      expect(Object.keys(m.Merchant.form.video)).toEqual(Object.keys(az.Merchant.form.video));
      expect(Object.keys(m.Pdp.video)).toEqual(Object.keys(az.Pdp.video));
      for (const text of [m.Pdp.video.play, m.Pdp.video.label, m.Product.hasVideo])
        expect(text.trim()).not.toBe("");
      expect(m.Pdp.video.play).toContain("{name}");
      expect(m.Pdp.video.label).toContain("{name}");
    }
  });
});
