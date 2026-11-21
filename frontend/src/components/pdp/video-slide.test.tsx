import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Gallery, type GalleryImage } from "./gallery";
import { VideoSlide, type GalleryVideo, type VideoLabels } from "./video-slide";

const videoLabels: VideoLabels = {
  badge: "Video",
  ai: "AI video",
  play: "Videonu oynat: Üzük",
  label: "Üzük: qısa video, səssiz",
  position: "Video, {n} / {total}",
  loading: "Video yüklənir",
};
const labels = {
  prev: "Əvvəlki şəkil",
  next: "Növbəti şəkil",
  zoom: "Şəkli böyüt",
  close: "Bağla",
  ai: "AI şəkli",
  position: "Şəkil {n} / {total}",
  video: videoLabels,
};
const images: GalleryImage[] = [
  { url: "/demo/a.jpg", alt: "Üzük önü", aiGenerated: false },
  { url: "/demo/b.jpg", alt: "Üzük yan", aiGenerated: false },
];
const video: GalleryVideo = {
  url: "https://img.example/products/1/2/video/clip.mp4",
  contentType: "video/mp4",
  aiGenerated: false,
  length: "0:08",
};

const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();

function reducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  play.mockClear();
  pause.mockClear();
  // jsdom has no media playback.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  reducedMotion(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const slide = (v: GalleryVideo = video) => (
  <VideoSlide video={v} poster={images[0]} sizes="100vw" labels={videoLabels} />
);

describe("VideoSlide", () => {
  it("shows the poster and a play button and requests nothing of the video", () => {
    const { container } = render(slide());
    expect(screen.getByRole("button", { name: "Videonu oynat: Üzük" })).toBeInTheDocument();
    expect(screen.getByText("0:08")).toBeInTheDocument();
    // No <video>, no <source>, no preload link: the file cannot be requested before the click.
    expect(container.querySelector("video, source")).toBeNull();
    expect(container.innerHTML).not.toContain("clip.mp4");
    expect(play).not.toHaveBeenCalled();
  });

  it("starts the muted, looping player with controls only after the click", async () => {
    const { container } = render(slide());
    fireEvent.click(screen.getByRole("button", { name: "Videonu oynat: Üzük" }));
    const player = await screen.findByLabelText<HTMLVideoElement>("Üzük: qısa video, səssiz");
    expect(player.tagName).toBe("VIDEO");
    expect(player.muted).toBe(true);
    expect(player.loop).toBe(true);
    expect(player.controls).toBe(true);
    expect(player).toHaveAttribute("preload", "none");
    expect(player).toHaveAttribute("playsinline");
    const source = container.querySelector("source");
    expect(source).toHaveAttribute("src", video.url);
    expect(source).toHaveAttribute("type", "video/mp4");
    expect(play).toHaveBeenCalledTimes(1);
    // The keyboard works at once: the player has the focus, the play button is gone.
    expect(player).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Videonu oynat: Üzük" })).toBeNull();
  });

  it("plays and pauses with the space bar, Enter and K", async () => {
    render(slide());
    fireEvent.click(screen.getByRole("button", { name: "Videonu oynat: Üzük" }));
    const player = await screen.findByLabelText<HTMLVideoElement>("Üzük: qısa video, səssiz");
    const paused = vi.spyOn(player, "paused", "get");

    paused.mockReturnValue(false);
    fireEvent.keyDown(player, { key: " " });
    expect(pause).toHaveBeenCalledTimes(1);

    paused.mockReturnValue(true);
    fireEvent.keyDown(player, { key: "Enter" });
    fireEvent.keyDown(player, { key: "k" });
    expect(play).toHaveBeenCalledTimes(3);

    // Other keys (the arrow keys seek) stay with the browser.
    fireEvent.keyDown(player, { key: "ArrowRight" });
    expect(play).toHaveBeenCalledTimes(3);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("does not loop for a visitor who asked for reduced motion", async () => {
    reducedMotion(true);
    render(slide());
    // Nothing moves until the visitor asks for it.
    expect(play).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Videonu oynat: Üzük" }));
    const player = await screen.findByLabelText<HTMLVideoElement>("Üzük: qısa video, səssiz");
    expect(player.loop).toBe(false);
  });

  it("labels an AI-made video and leaves a seller's own clip unlabelled", () => {
    const { unmount } = render(slide());
    expect(screen.queryByText("AI video")).toBeNull();
    unmount();
    render(slide({ ...video, aiGenerated: true }));
    expect(screen.getByText("AI video")).toBeInTheDocument();
  });
});

describe("Gallery with a video", () => {
  it("puts the video frame after the cover photo, in the carousel and in the grid", () => {
    const { container } = render(
      <Gallery productId={1} images={images} video={video} labels={labels} />,
    );
    // Two photos and the video: three frames on the phone carousel.
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Videonu oynat: Üzük", hidden: true }),
    ).toHaveLength(2);
    const cells = [...container.querySelectorAll("ul > li")];
    expect(cells).toHaveLength(3);
    expect(within(cells[1] as HTMLElement).getByText("Video")).toBeInTheDocument();
    // The photos keep their own numbering in the full view.
    expect(screen.getByRole("button", { name: "Şəkli böyüt: Şəkil 2 / 2" })).toBeInTheDocument();
    expect(container.querySelector("video")).toBeNull();
  });

  it("announces the video frame and pauses the video when the carousel moves on", async () => {
    const { container } = render(
      <Gallery productId={1} images={images} video={video} labels={labels} />,
    );
    const carousel = container.querySelector<HTMLElement>("[aria-roledescription=carousel]")!;
    fireEvent.click(within(carousel).getByRole("button", { name: "Növbəti şəkil" }));
    expect(within(carousel).getByText("Video, 2 / 3")).toBeInTheDocument();
    // The enlarge button belongs to photos.
    expect(within(carousel).queryByRole("button", { name: "Şəkli böyüt" })).toBeNull();

    fireEvent.click(within(carousel).getByRole("button", { name: "Videonu oynat: Üzük" }));
    await within(carousel).findByLabelText("Üzük: qısa video, səssiz");
    pause.mockClear();
    fireEvent.click(within(carousel).getByRole("button", { name: "Növbəti şəkil" }));
    expect(pause).toHaveBeenCalled();
    expect(within(carousel).getByText("Şəkil 3 / 3")).toBeInTheDocument();
  });

  it("leaves no frame, badge or gap when the product has no video", () => {
    const { container } = render(<Gallery productId={1} images={images} labels={labels} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(screen.queryByText("Video")).toBeNull();
    expect(screen.queryByRole("button", { name: /Videonu oynat/, hidden: true })).toBeNull();
  });

  it("shows a product that has only a video", () => {
    render(<Gallery productId={1} images={[]} video={video} labels={labels} />);
    expect(screen.getAllByRole("button", { name: "Videonu oynat: Üzük" })).toHaveLength(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
