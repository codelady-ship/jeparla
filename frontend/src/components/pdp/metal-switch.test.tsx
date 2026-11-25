import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetalSwitch } from "./metal-switch";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, prefetch: _p, ...rest }: Record<string, unknown>) => (
    <a href={href as string} {...rest}>
      {children as React.ReactNode}
    </a>
  ),
}));

const names = { GOLD: "Qızıl", SILVER: "Gümüş", PLATINUM: "Platin", PALLADIUM: "Palladium" };

describe("MetalSwitch", () => {
  it("marks the current metal and links the other, gold first", () => {
    render(
      <MetalSwitch
        metal="SILVER"
        sibling={{ slug: "ring-gold-585-7", metal: "GOLD" }}
        label="Bu dizayn başqa metalda"
        names={names}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Bu dizayn başqa metalda" });
    const items = nav.querySelectorAll("li");
    expect(items[0].textContent).toBe("Qızıl");
    expect(items[1].textContent).toBe("Gümüş");
    expect(screen.getByRole("link", { name: "Qızıl" })).toHaveAttribute(
      "href",
      "/products/ring-gold-585-7",
    );
    expect(screen.getByText("Gümüş")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Gümüş" })).toBeNull();
  });
});
