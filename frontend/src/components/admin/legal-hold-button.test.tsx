import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import az from "../../../messages/az.json";
import { LegalHoldButton } from "./legal-hold-button";

const H = az.Admin.legalHold;
const NAME = "Günəş Zərgər";

function renderButton(heldAt: string | null, onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="az" messages={az}>
      <LegalHoldButton storeId={7} name={NAME} heldAt={heldAt} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

afterEach(() => vi.unstubAllGlobals());

describe("LegalHoldButton (#249)", () => {
  it("needs a reason before placing a hold and sends it", async () => {
    const at = "2026-11-16T10:00:00Z";
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ storeId: 7, legalHoldAt: at, legalHoldReason: "Sorğu № 12/345" }),
      );
    vi.stubGlobal("fetch", fetch);
    const onChange = renderButton(null);

    fireEvent.click(screen.getByRole("button", { name: `${H.place}: ${NAME}` }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: H.place }));
    expect(await screen.findByText(az.Admin.errors.reasonRequired)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(H.reason), { target: { value: "Sorğu № 12/345" } });
    fireEvent.click(within(dialog).getByRole("button", { name: H.place }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(at));
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/admin/stores/7/legal-hold");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ hold: true, reason: "Sorğu № 12/345" });
  });

  it("releases a hold after showing when and why it was placed", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          storeId: 7,
          legalHoldAt: "2026-11-01T10:00:00Z",
          legalHoldReason: "Sorğu № 12/345",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ storeId: 7, legalHoldAt: null, legalHoldReason: null }),
      );
    vi.stubGlobal("fetch", fetch);
    const onChange = renderButton("2026-11-01T10:00:00Z");

    fireEvent.click(screen.getByRole("button", { name: `${H.release}: ${NAME}` }));
    expect(await screen.findByText("Sorğu № 12/345")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: H.release }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ hold: false });
  });
});
