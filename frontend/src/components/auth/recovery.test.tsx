import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import az from "../../../messages/az.json";
import { setSession } from "@/lib/auth/client";
import * as recovery from "@/lib/auth/recovery";
import type { AuthFormLabels } from "./auth-form";
import { ForgotPasswordForm, ResetPasswordView, VerifyEmailView } from "./recovery";
import type { ResendLabels } from "./resend-verification";
import { VerifyEmailBanner } from "./verify-email-banner";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const A = az.Auth;
const TOKEN = "Zm9vYmFyYmF6cXV4LXF1dXhfY29yZ2VncmF1bHRnYXJwbHk";

const labels = (submit: string, sentNotice?: string): AuthFormLabels => ({
  fields: A.fields,
  hints: {},
  errors: { ...A.errors, passwordShort: A.errors.passwordShort.replace("{min}", "8") },
  submit,
  pending: A.pending,
  showPassword: A.showPassword,
  hidePassword: A.hidePassword,
  sentNotice,
});

const resend: ResendLabels = {
  ...A.resend,
  pending: A.pending,
  rateLimited: A.errors.rateLimitedUntil,
  network: A.errors.network,
  server: A.errors.server,
};

const wrap = (ui: ReactNode) =>
  render(
    <NextIntlClientProvider locale="az" messages={{}}>
      {ui}
    </NextIntlClientProvider>,
  );

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  setSession(null);
  window.history.replaceState(null, "", "/az");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ForgotPasswordForm", () => {
  it("shows the same neutral notice after a valid request", async () => {
    const spy = vi
      .spyOn(recovery, "requestPasswordReset")
      .mockResolvedValue({ outcome: "sent", retryAfter: null });
    wrap(<ForgotPasswordForm labels={labels(A.forgot.submit, A.forgot.notice)} />);
    fill(A.fields.email, "  sahib@example.az ");
    fireEvent.click(screen.getByRole("button", { name: A.forgot.submit }));
    expect(await screen.findByRole("status")).toHaveTextContent(A.forgot.notice);
    expect(spy).toHaveBeenCalledWith("sahib@example.az");
  });

  it("names the time to try again after a 429", async () => {
    vi.spyOn(recovery, "requestPasswordReset").mockResolvedValue({
      outcome: "rateLimited",
      retryAfter: 600,
    });
    wrap(<ForgotPasswordForm labels={labels(A.forgot.submit, A.forgot.notice)} />);
    fill(A.fields.email, "sahib@example.az");
    fireEvent.click(screen.getByRole("button", { name: A.forgot.submit }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Yenidən cəhd vaxtı: \d{2}:\d{2}\./);
  });
});

describe("ResetPasswordView", () => {
  const texts = {
    checking: A.reset.checking,
    done: A.reset.done,
    signIn: A.reset.signIn,
    invalid: A.reset.invalid,
    requestNew: A.reset.requestNew,
  };

  it("without a token links back to the forgot-password page", async () => {
    wrap(<ResetPasswordView labels={labels(A.reset.submit)} texts={texts} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(A.reset.invalid);
    expect(screen.getByRole("link", { name: A.reset.requestNew })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("clears the fragment, sets the password and drops the local session", async () => {
    window.history.replaceState(null, "", `/az/reset-password#token=${TOKEN}`);
    const reset = vi
      .spyOn(recovery, "resetPassword")
      .mockResolvedValue({ outcome: "done", retryAfter: null });
    setSession({ name: "Aysel", email: "a@b.az", role: "USER", emailVerified: false });

    wrap(
      <>
        <VerifyEmailBanner
          text={A.verifyBanner.text}
          detail={A.verifyBanner.detail}
          resend={resend}
        />
        <ResetPasswordView labels={labels(A.reset.submit)} texts={texts} />
      </>,
    );
    // The banner stands for the signed-in session here.
    expect(screen.getByText(A.verifyBanner.text)).toBeInTheDocument();
    await screen.findByLabelText(A.fields.password);
    expect(window.location.hash).toBe("");

    fill(A.fields.password, "Yeni2026");
    fill(A.fields.confirm, "Yeni2026");
    fireEvent.click(screen.getByRole("button", { name: A.reset.submit }));

    expect(await screen.findByRole("status")).toHaveTextContent(A.reset.done);
    expect(reset).toHaveBeenCalledWith(TOKEN, "Yeni2026");
    // The route handler ended the session cookies; the page forgets the session too.
    expect(screen.queryByText(A.verifyBanner.text)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: A.reset.signIn })).toHaveAttribute("href", "/login");
  });

  it("checks the rules in the browser before calling the API", async () => {
    window.history.replaceState(null, "", `/az/reset-password#token=${TOKEN}`);
    const reset = vi.spyOn(recovery, "resetPassword");
    wrap(<ResetPasswordView labels={labels(A.reset.submit)} texts={texts} />);
    await screen.findByLabelText(A.fields.password);
    fill(A.fields.password, "qisa");
    fill(A.fields.confirm, "basqa");
    fireEvent.click(screen.getByRole("button", { name: A.reset.submit }));
    expect(await screen.findByText(A.errors.passwordMismatch)).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
  });

  it("turns an expired or used link into the invalid state", async () => {
    window.history.replaceState(null, "", `/az/reset-password#token=${TOKEN}`);
    vi.spyOn(recovery, "resetPassword").mockResolvedValue({
      outcome: "invalidToken",
      retryAfter: null,
    });
    wrap(<ResetPasswordView labels={labels(A.reset.submit)} texts={texts} />);
    await screen.findByLabelText(A.fields.password);
    fill(A.fields.password, "Yeni2026");
    fill(A.fields.confirm, "Yeni2026");
    fireEvent.click(screen.getByRole("button", { name: A.reset.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(A.reset.invalid);
  });
});

describe("VerifyEmailView", () => {
  const texts = {
    checking: A.verify.checking,
    done: A.verify.done,
    toHome: A.verify.toHome,
    invalid: A.verify.invalid,
    signInForNew: A.verify.signInForNew,
    signIn: A.login.submit,
    retry: A.verify.retry,
    rateLimited: A.errors.rateLimitedUntil,
    network: A.errors.network,
    server: A.errors.server,
  };

  it("confirms the address and updates the signed-in session", async () => {
    window.history.replaceState(null, "", `/az/verify-email#token=${TOKEN}`);
    const verify = vi
      .spyOn(recovery, "verifyEmail")
      .mockResolvedValue({ outcome: "done", retryAfter: null });
    setSession({ name: "Aysel", email: "a@b.az", role: "USER", emailVerified: false });
    wrap(
      <>
        <VerifyEmailBanner
          text={A.verifyBanner.text}
          detail={A.verifyBanner.detail}
          resend={resend}
        />
        <VerifyEmailView texts={texts} resendLabels={resend} />
      </>,
    );
    expect(await screen.findByText(A.verify.done)).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith(TOKEN);
    expect(window.location.hash).toBe("");
    await waitFor(() => expect(screen.queryByText(A.verifyBanner.text)).not.toBeInTheDocument());
  });

  it("asks a guest with a broken link to sign in for a new one", async () => {
    window.history.replaceState(null, "", "/az/verify-email#token=bad");
    const verify = vi.spyOn(recovery, "verifyEmail");
    wrap(<VerifyEmailView texts={texts} resendLabels={resend} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(A.verify.invalid);
    expect(screen.getByText(A.verify.signInForNew)).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it("offers a signed-in user to send the link again", async () => {
    window.history.replaceState(null, "", `/az/verify-email#token=${TOKEN}`);
    vi.spyOn(recovery, "verifyEmail").mockResolvedValue({
      outcome: "invalidToken",
      retryAfter: null,
    });
    const send = vi
      .spyOn(recovery, "resendVerification")
      .mockResolvedValue({ outcome: "sent", retryAfter: null });
    setSession({ name: "Aysel", email: "a@b.az", role: "USER", emailVerified: false });
    wrap(<VerifyEmailView texts={texts} resendLabels={resend} />);
    fireEvent.click(await screen.findByRole("button", { name: A.resend.button }));
    expect(await screen.findByText(A.resend.sent)).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("lets the visitor retry after a network error", async () => {
    window.history.replaceState(null, "", `/az/verify-email#token=${TOKEN}`);
    const verify = vi
      .spyOn(recovery, "verifyEmail")
      .mockResolvedValueOnce({ outcome: "network", retryAfter: null })
      .mockResolvedValueOnce({ outcome: "done", retryAfter: null });
    wrap(<VerifyEmailView texts={texts} resendLabels={resend} />);
    fireEvent.click(await screen.findByRole("button", { name: A.verify.retry }));
    expect(await screen.findByText(A.verify.done)).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(2);
  });
});

describe("VerifyEmailBanner", () => {
  it("shows only for a session with an unconfirmed address", async () => {
    const { rerender } = wrap(
      <VerifyEmailBanner
        text={A.verifyBanner.text}
        detail={A.verifyBanner.detail}
        resend={resend}
      />,
    );
    expect(screen.queryByText(A.verifyBanner.text)).not.toBeInTheDocument();

    act(() => setSession({ name: "A", email: "a@b.az", role: "USER" }));
    expect(screen.queryByText(A.verifyBanner.text)).not.toBeInTheDocument();

    act(() => setSession({ name: "A", email: "a@b.az", role: "USER", emailVerified: false }));
    rerender(
      <NextIntlClientProvider locale="az" messages={{}}>
        <VerifyEmailBanner
          text={A.verifyBanner.text}
          detail={A.verifyBanner.detail}
          resend={resend}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("complementary", { name: A.verifyBanner.text })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: A.resend.button })).toBeInTheDocument();
  });

  it("reports an already confirmed address and hides itself", async () => {
    vi.spyOn(recovery, "resendVerification").mockResolvedValue({
      outcome: "alreadyVerified",
      retryAfter: null,
    });
    setSession({ name: "A", email: "a@b.az", role: "USER", emailVerified: false });
    wrap(
      <VerifyEmailBanner
        text={A.verifyBanner.text}
        detail={A.verifyBanner.detail}
        resend={resend}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: A.resend.button }));
    await waitFor(() => expect(screen.queryByText(A.verifyBanner.text)).not.toBeInTheDocument());
  });
});
