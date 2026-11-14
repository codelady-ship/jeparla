import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChangingValue } from "./changing-value";

const KEY = "jeparla.seen.metal.az.GOLD-585";

describe("ChangingValue", () => {
  afterEach(() => window.localStorage.clear());

  it("shows the value without motion on a first visit and remembers it", () => {
    const { container } = render(<ChangingValue storageKey="metal.az.GOLD-585" text="95,10 ₼" />);
    expect(container.textContent).toBe("95,10 ₼");
    expect(container.querySelector(".value-in")).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBe("95,10 ₼");
  });

  it("does nothing when the value is unchanged", async () => {
    window.localStorage.setItem(KEY, "95,10 ₼");
    const { container } = render(<ChangingValue storageKey="metal.az.GOLD-585" text="95,10 ₼" />);
    await new Promise((r) => requestAnimationFrame(r));
    expect(container.querySelector(".value-out")).toBeNull();
  });

  it("layers the old value (hidden from screen readers) over the new one when it changed", async () => {
    window.localStorage.setItem(KEY, "94,80 ₼");
    const { container } = render(<ChangingValue storageKey="metal.az.GOLD-585" text="95,10 ₼" />);
    await waitFor(() => expect(container.querySelector(".value-out")).not.toBeNull());
    expect(container.querySelector(".value-out")).toHaveAttribute("aria-hidden");
    expect(screen.getByText("95,10 ₼")).toHaveClass("value-in");
    expect(window.localStorage.getItem(KEY)).toBe("95,10 ₼");
  });
});
