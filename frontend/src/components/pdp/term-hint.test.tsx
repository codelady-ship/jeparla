import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TermHint } from "./term-hint";

describe("TermHint", () => {
  it("is a named button that opens the explanation", async () => {
    render(
      <TermHint term="Əyar" label="Əyar nədir?" text="585 əyarlı qızılda 58,5% təmiz qızıl var." />,
    );
    const button = screen.getByRole("button", { name: "Əyar nədir?" });
    expect(screen.queryByText(/58,5%/)).toBeNull();
    fireEvent.click(button);
    expect(await screen.findByText(/58,5%/)).toBeInTheDocument();
  });
});
