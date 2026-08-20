import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    vi.stubEnv("HBM_REGISTRATION_ENABLED", "true");
    resetRateLimitsForTests();
    vi.clearAllMocks();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects self-service registration before parsing or creating an account when disabled", async () => {
    vi.stubEnv("HBM_REGISTRATION_ENABLED", "false");

    const response = await register({ email: "new@example.com", password: VALID_PASSWORD, acceptTerms: true });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Self-service registration is not available",
      code: "registration_disabled",
    });
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("creates an immediately usable account", async () => {
    const response = await register({
      email: "New@Example.com",
      password: VALID_PASSWORD,
      timezone: "Europe/Berlin",
      acceptTerms: true
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "registered",
      email: "new@example.com"
    });
    expect(registerUser).toHaveBeenCalledWith({
      email: "new@example.com",
      password: VALID_PASSWORD,
      timezone: "Europe/Berlin"
    });
  });

  it("rejects a registration that does not accept the terms", async () => {
    const response = await register({ email: "new@example.com", password: VALID_PASSWORD });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_registration");
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("rejects a registration that explicitly declines the terms", async () => {
    const response = await register({ email: "new@example.com", password: VALID_PASSWORD, acceptTerms: false });

    expect(response.status).toBe(400);
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("rejects passwords shorter than 12 characters", async () => {
    const response = await register({ email: "new@example.com", password: "short", acceptTerms: true });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_registration");
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("rejects malformed email addresses", async () => {
    const response = await register({ email: "not-an-email", password: VALID_PASSWORD, acceptTerms: true });

    expect(response.status).toBe(400);
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("returns the same response for an address that is already registered", async () => {
    const fresh = await register({ email: "taken@example.com", password: VALID_PASSWORD, acceptTerms: true });
    const freshBody = await fresh.json();

    resetRateLimitsForTests();
    vi.mocked(registerUser).mockResolvedValueOnce(undefined);
    const repeat = await register({ email: "taken@example.com", password: VALID_PASSWORD, acceptTerms: true });

    expect(repeat.status).toBe(fresh.status);
    await expect(repeat.json()).resolves.toEqual(freshBody);
  });

  it("reports a failure when the account cannot be created", async () => {
    vi.mocked(registerUser).mockRejectedValueOnce(new Error("database down"));

    const response = await register({ email: "new@example.com", password: VALID_PASSWORD, acceptTerms: true });

    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe("registration_failed");
  });

  it("rate limits repeated attempts against the same address", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await register(
        { email: "spam@example.com", password: VALID_PASSWORD, acceptTerms: true },
        `198.51.100.${attempt + 1}`
      );
      expect(response.status).toBe(200);
    }

    const blocked = await register(
      { email: "spam@example.com", password: VALID_PASSWORD, acceptTerms: true },
      "198.51.100.99"
    );

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
