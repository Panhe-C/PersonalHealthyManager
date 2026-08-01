import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/passwordReset", async () => {
  const actual = await vi.importActual<typeof import("@/src/auth/passwordReset")>("@/src/auth/passwordReset");
  return { ...actual, requestPasswordReset: vi.fn(), resetPassword: vi.fn() };
});

import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";
import { requestPasswordReset, resetPassword } from "@/src/auth/passwordReset";
import { resetRateLimitsForTests } from "@/src/security/rateLimit";

const VALID_PASSWORD = "a-sufficiently-long-password";

function forgot(body: unknown, ip = "203.0.113.7") {
  return forgotPassword(
    new Request("http://localhost/api/auth/forgot-password", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(body)
    })
  );
}

function reset(body: unknown) {
  return resetPasswordRoute(
    new Request("http://localhost/api/auth/reset-password", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.7" },
      body: JSON.stringify(body)
    })
  );
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    vi.clearAllMocks();
    vi.mocked(requestPasswordReset).mockResolvedValue(undefined);
  });

  it("answers identically for a registered and an unknown address", async () => {
    const registered = await forgot({ email: "owner@example.test" });
    const unknown = await forgot({ email: "stranger@example.test" });

    expect(registered.status).toBe(unknown.status);
    await expect(registered.json()).resolves.toEqual({
      ok: true,
      status: "reset_sent",
      email: "owner@example.test"
    });
    await expect(unknown.json()).resolves.toEqual({
      ok: true,
      status: "reset_sent",
      email: "stranger@example.test"
    });
  });

  it("rejects a malformed address without hitting the service", async () => {
    const response = await forgot({ email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("limits repeated requests for the same address", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const allowed = await forgot({ email: "owner@example.test" });
      expect(allowed.status).toBe(200);
    }

    const blocked = await forgot({ email: "owner@example.test" });

    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe("rate_limited");
  });

  it("limits a single IP that walks through many addresses", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const allowed = await forgot({ email: `user-${attempt}@example.test` });
      expect(allowed.status).toBe(200);
    }

    const blocked = await forgot({ email: "user-11@example.test" });

    expect(blocked.status).toBe(429);
  });

  it("reports a mail transport failure rather than claiming success", async () => {
    vi.mocked(requestPasswordReset).mockRejectedValue(new Error("smtp down"));

    const response = await forgot({ email: "owner@example.test" });

    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("reset_send_failed");
  });
});

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    vi.clearAllMocks();
  });

  it("accepts a valid token and password", async () => {
    vi.mocked(resetPassword).mockResolvedValue({ ok: true });

    const response = await reset({ token: "good", password: VALID_PASSWORD });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(resetPassword).toHaveBeenCalledWith("good", VALID_PASSWORD);
  });

  it("returns 410 for an expired token so the page can offer a new link", async () => {
    vi.mocked(resetPassword).mockResolvedValue({ ok: false, reason: "expired" });

    const response = await reset({ token: "stale", password: VALID_PASSWORD });

    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe("expired_token");
  });

  it("returns 400 for an unknown or already used token", async () => {
    vi.mocked(resetPassword).mockResolvedValue({ ok: false, reason: "invalid" });

    const response = await reset({ token: "nope", password: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_token");
  });

  it("separates a weak password from a bad link so the form can point at the field", async () => {
    const response = await reset({ token: "good", password: "short" });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("weak_password");
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("rejects a request with no token without hitting the service", async () => {
    const response = await reset({ password: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_token");
    expect(resetPassword).not.toHaveBeenCalled();
  });
});
