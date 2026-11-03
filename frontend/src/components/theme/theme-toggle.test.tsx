import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

const setTheme = vi.fn();
let resolvedTheme = "light";
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme, setTheme }) }));

const labels = { toDark: "Gecə rejimi", toLight: "Gündüz rejimi" };

describe("ThemeToggle", () => {
  it("switches light to dark", () => {
    resolvedTheme = "light";
    render(<ThemeToggle labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: labels.toDark }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("switches dark to light", () => {
    resolvedTheme = "dark";
    render(<ThemeToggle labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: labels.toLight }));
    expect(setTheme).toHaveBeenCalledWith("light");
  });
});
