import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import az from "../../../messages/az.json";
import { DecisionButtons } from "./decision-buttons";

function renderButtons(onDone = vi.fn()) {
  render(
    <NextIntlClientProvider locale="az" messages={az}>
      <DecisionButtons
        endpoint="/api/admin/stores/7"
        name="Günəş Zərgər"
        actions={["approve", "reject"]}
        onDone={onDone}
      />
    </NextIntlClientProvider>,
  );
  return onDone;
}

afterEach(() => vi.unstubAllGlobals());

describe("DecisionButtons", () => {
  it("names each button after the store", () => {
    renderButtons();
    expect(screen.getByRole("button", { name: "Təsdiqlə: Günəş Zərgər" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rədd et: Günəş Zərgər" })).toBeInTheDocument();
  });

  it("asks for a reason before rejecting and sends nothing without one", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    renderButtons();
    fireEvent.click(screen.getByRole("button", { name: "Rədd et: Günəş Zərgər" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Günəş Zərgər rədd edilsin?");
    fireEvent.click(screen.getByRole("button", { name: "Rədd et" }));
    expect(await screen.findByText(az.Admin.errors.reasonRequired)).toBeInTheDocument();
    expect(screen.getByLabelText(az.Admin.reason.label)).toHaveAttribute("aria-invalid", "true");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("confirms an approval and reports the new status", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 7, status: "APPROVED", note: null }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetch);
    const onDone = renderButtons();
    fireEvent.click(screen.getByRole("button", { name: "Təsdiqlə: Günəş Zərgər" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Təsdiqlə" }));
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({ id: 7, status: "APPROVED", note: null }, "approve"),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/stores/7",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("shows a stale-data error from the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ errors: { form: "conflict" } }), { status: 409 }),
        ),
    );
    renderButtons();
    fireEvent.click(screen.getByRole("button", { name: "Təsdiqlə: Günəş Zərgər" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Təsdiqlə" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(az.Admin.errors.conflict);
  });
});
