import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/registration", async () => {
  const actual = await vi.importActual<typeof import("@/src/auth/registration")>("@/src/auth/registration");
  return { ...actual, registerUser: vi.fn(), resendVerification: vi.fn() };
});

import { POST as REGISTER } from "@/app/api/auth/register/route";
import { POST as RESEND } from "@/app/api/auth/resend-verification/route";
import { registerUser, resendVerification } from "@/src/auth/registration";
import { resetRateLimitsForTests } from "@/src/security/rateLimit";

const VALID_PASSWORD = "a-sufficiently-long-password";

function register(body: unknown, ip = "203.0.113.1") {
  return REGISTER(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(body)
    })
  );
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    vi.clearAllMocks();
  });

  it("creates the account and reports that verification was sent", async () => {
    const response = await register({ email: "New@Example.com", password: VALID_PASSWORD, timezone: "Europe/Berlin" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "verification_sent",
      email: "new@example.com"
    });
    expect(registerUser).toHaveBeenCalledWith({
      email: "new@example.com",
      password: VALID_PASSWORD,
      timezone: "Europe/Berlin"
    });
  });

  it("rejects passwords shorter than 12 characters", async () => {
    const response = await register({ email: "new@example.com", password: "short" });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_registration");
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("rejects malformed email addresses", async () => {
    const response = await register({ email: "not-an-email", password: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("returns the same response for an address that is already registered", async () => {
    const fresh = await register({ email: "taken@example.com", password: VALID_PASSWORD });
    const freshBody = await fresh.json();

    resetRateLimitsForTests();
    vi.mocked(registerUser).mockResolvedValueOnce(undefined);
    const repeat = await register({ email: "taken@example.com", password: VALID_PASSWORD });

    expect(repeat.status).toBe(fresh.status);
    await expect(repeat.json()).resolves.toEqual(freshBody);
  });

  it("reports a failure when the verification email cannot be sent", async () => {
    vi.mocked(registerUser).mockRejectedValueOnce(new Error("smtp down"));

    const response = await register({ email: "new@example.com", password: VALID_PASSWORD });

    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("verification_send_failed");
  });

  it("rate limits repeated attempts against the same address", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await register(
        { email: "spam@example.com", password: VALID_PASSWORD },
        `198.51.100.${attempt + 1}`
      );
      expect(response.status).toBe(200);
    }

    const blocked = await register({ email: "spam@example.com", password: VALID_PASSWORD }, "198.51.100.99");

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(registerUser).toHaveBeenCalledTimes(5);
  });
});

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    vi.clearAllMocks();
  });

  function resend(email: string, ip = "203.0.113.5") {
    return RESEND(
      new Request("http://localhost/api/auth/resend-verification", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify({ email })
      })
    );
  }

  it("acknowledges the request without revealing whether the address exists", async () => {
    const response = await resend("Unknown@Example.com");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "verification_sent",
      email: "unknown@example.com"
    });
    expect(resendVerification).toHaveBeenCalledWith("unknown@example.com");
  });

  it("rate limits repeated requests for one address", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await resend("pending@example.com", `198.51.100.${attempt + 1}`);
      expect(response.status).toBe(200);
    }

    const blocked = await resend("pending@example.com", "198.51.100.99");

    expect(blocked.status).toBe(429);
    expect(resendVerification).toHaveBeenCalledTimes(3);
  });
});
