import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Gallery, type GalleryImage } from "./gallery";

const labels = {
  prev: "Əvvəlki şəkil",
  next: "Növbəti şəkil",
  zoom: "Şəkli böyüt",
  close: "Bağla",
  ai: "AI şəkli",
  position: "Şəkil {n} / {total}",
};
const images: GalleryImage[] = [
  { url: "/demo/a.jpg", alt: "Üzük önü", aiGenerated: false },
  { url: "/demo/b.jpg", alt: "Üzük modeldə", aiGenerated: true },
  { url: "/demo/c.jpg", alt: "Üzük yan", aiGenerated: false },
];

describe("Gallery", () => {
  it("shows a 1 / 3 counter on the carousel and one grid button per photo", () => {
    render(<Gallery productId={1} images={images} labels={labels} />);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    for (let n = 1; n <= 3; n++) {
      expect(
        screen.getByRole("button", { name: new RegExp(`Şəkli böyüt: Şəkil ${n} / 3$`) }),
      ).toBeInTheDocument();
    }
  });

  // A visible badge starts the button name (WCAG 2.5.3, axe label-content-name-mismatch).
  it("labels AI images in the grid", () => {
    render(<Gallery productId={1} images={images} labels={labels} />);
    const second = screen.getByRole("button", { name: "AI şəkli. Şəkli böyüt: Şəkil 2 / 3" });
    expect(within(second).getByText("AI şəkli")).toBeInTheDocument();
  });

  it("names a hallmark shot with its own badge (#106)", () => {
    const withHallmark = [
      ...images,
      { url: "/demo/d.jpg", alt: "Üzük: əyar damğası", aiGenerated: false, badge: "Damğa" },
    ];
    render(<Gallery productId={1} images={withHallmark} labels={labels} />);
    const fourth = screen.getByRole("button", { name: "Damğa. Şəkli böyüt: Şəkil 4 / 4" });
    expect(within(fourth).getByText("Damğa")).toBeInTheDocument();
    expect(within(fourth).getByAltText("Üzük: əyar damğası")).toBeInTheDocument();
  });

  it("opens the full view at the clicked photo and moves with the arrow keys", async () => {
    render(<Gallery productId={1} images={images} labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "AI şəkli. Şəkli böyüt: Şəkil 2 / 3" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Şəkil 2 / 3")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(within(dialog).getByText("Şəkil 3 / 3")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(within(dialog).getByText("Şəkil 1 / 3")).toBeInTheDocument();
  });

  describe("on-model jump (#315)", () => {
    const withModel = { ...labels, onModel: { show: "Modeldə bax", back: "Orijinal şəklə bax" } };
    const onModel = images.map((img, n) => (n === 1 ? { ...img, onModel: true } : img));
    // jsdom renders both layouts: the carousel (phones) comes first, the desktop grid second.
    const buttons = (name: string) => screen.getAllByRole("button", { name });

    it("moves the carousel to the on-model photo and back, as an overlay", () => {
      render(<Gallery productId={1} images={onModel} labels={withModel} />);
      const [carousel] = buttons("Modeldə bax");
      fireEvent.click(carousel);
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
      expect(buttons("Orijinal şəklə bax")[0]).toBe(carousel);
      fireEvent.click(carousel);
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    it("on the desktop grid sits on the cover photo and focuses the on-model photo", () => {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({ matches: false }),
      });
      Element.prototype.scrollIntoView = () => {};
      render(<Gallery productId={1} images={onModel} labels={withModel} />);
      const desktop = buttons("Modeldə bax")[1];
      expect(desktop.closest("li")).toBe(screen.getAllByRole("listitem")[0]);
      fireEvent.click(desktop);
      expect(
        screen.getByRole("button", { name: "AI şəkli. Şəkli böyüt: Şəkil 2 / 3" }),
      ).toHaveFocus();
    });

    // Honesty (review of #336): an AI photo that is not on a model never gets the button.
    it("is absent for AI photos without a model, and when the only photo is on a model", () => {
      const { unmount } = render(<Gallery productId={1} images={images} labels={withModel} />);
      expect(screen.queryByText("Modeldə bax")).toBeNull();
      unmount();
      render(<Gallery productId={1} images={[onModel[1]]} labels={withModel} />);
      expect(screen.queryByText("Modeldə bax")).toBeNull();
    });
  });
});
