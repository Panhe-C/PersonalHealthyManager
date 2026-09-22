import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/registration", async () => {
  const actual = await vi.importActual<typeof import("@/src/auth/registration")>("@/src/auth/registration");
  return { ...actual, verifyEmail: vi.fn() };
});

import { POST } from "@/app/api/auth/verify-email/route";
import { verifyEmail } from "@/src/auth/registration";
import { resetRateLimitsForTests } from "@/src/security/rateLimit";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.7" },
      body: JSON.stringify(body)
    })
  );
}

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    vi.clearAllMocks();
  });

  it("confirms a valid token", async () => {
    vi.mocked(verifyEmail).mockResolvedValue({ ok: true, alreadyVerified: false });

    const response = await post({ token: "good" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, alreadyVerified: false });
    expect(verifyEmail).toHaveBeenCalledWith("good");
  });

  it("reports a token that was already used", async () => {
    vi.mocked(verifyEmail).mockResolvedValue({ ok: true, alreadyVerified: true });

    const response = await post({ token: "used" });

    expect(response.status).toBe(200);
    expect((await response.json()).alreadyVerified).toBe(true);
  });

  it("returns 410 for an expired token so the client can offer a resend", async () => {
    vi.mocked(verifyEmail).mockResolvedValue({ ok: false, reason: "expired" });

    const response = await post({ token: "stale" });

    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe("expired_token");
  });

  it("returns 400 for an unknown token", async () => {
    vi.mocked(verifyEmail).mockResolvedValue({ ok: false, reason: "invalid" });

    const response = await post({ token: "nope" });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_token");
  });

  it("rejects a request with no token without hitting the service", async () => {
    const response = await post({});

    expect(response.status).toBe(400);
    expect(verifyEmail).not.toHaveBeenCalled();
  });
});
