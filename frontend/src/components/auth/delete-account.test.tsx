import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import az from "../../../messages/az.json";
import { DeleteAccount } from "./delete-account";

const replace = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }),
}));

const A = az.Account;

const wrap = () =>
  render(
    <NextIntlClientProvider locale="az" messages={{ Account: A }}>
      <DeleteAccount />
    </NextIntlClientProvider>,
  );

function open() {
  fireEvent.click(screen.getByRole("button", { name: A.deleteButton }));
}

function confirm(password: string) {
  fireEvent.change(screen.getByLabelText(A.password), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: A.confirmButton }));
}

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

describe("DeleteAccount (#249)", () => {
  it("says what goes and what stays before anything is deleted", () => {
    wrap();
    expect(screen.getByText(A.deleteGoes)).toBeTruthy();
    expect(screen.getByText(A.deleteStays)).toBeTruthy();
    expect(screen.getByText(A.deleteStore)).toBeTruthy();
  });

  it("asks for the password and sends it with DELETE", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    wrap();
    open();
    fireEvent.click(screen.getByRole("button", { name: A.confirmButton }));
    expect(await screen.findByText(A.errors.required)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    confirm("parol123");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/account");
    expect(init?.method).toBe("DELETE");
    expect(JSON.parse(String(init?.body))).toEqual({ password: "parol123" });
  });

  it("shows the backend's own sentence, e.g. for a store owner", async () => {
    const sentence = "Hesabınıza mağaza bağlıdır. Hesabı silmək üçün dəstəyə yazın.";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ errors: { form: sentence } }, { status: 409 }),
    );
    wrap();
    open();
    confirm("parol123");
    expect(await screen.findByText(sentence)).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});
