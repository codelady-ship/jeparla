import { describe, expect, it } from "vitest";
import { ApiError } from "./http";
import { problemResponse } from "./problem";

describe("problemResponse", () => {
  it("shows the backend's sentence for a wrong password, not 'session expired'", async () => {
    const res = problemResponse(
      new ApiError(
        401,
        "/auth/login",
        "auth.invalid_credentials",
        "E-poçt, telefon və ya şifrə yanlışdır.",
      ),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).errors.form).toBe("E-poçt, telefon və ya şifrə yanlışdır.");
  });

  it("still says the session expired for any other 401", async () => {
    const res = problemResponse(new ApiError(401, "/merchant/store", null, null));
    expect((await res.json()).errors.form).toBe("sessionExpired");
  });
});
