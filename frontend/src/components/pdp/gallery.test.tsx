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
});
