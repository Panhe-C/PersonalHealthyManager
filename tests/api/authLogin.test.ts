import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/password", () => ({
  verifyPassword: vi.fn(() => true)
}));

vi.mock("@/src/auth/session", () => ({
  createSession: vi.fn()
}));

vi.mock("@/src/db/client", () => ({
  prisma: {
    user: { findUnique: vi.fn() }
  }
}));

import { POST } from "@/app/api/auth/login/route";
import { verifyPassword } from "@/src/auth/password";
import { createSession } from "@/src/auth/session";
import { prisma } from "@/src/db/client";
import { resetRateLimitsForTests } from "@/src/security/rateLimit";

const user = {
  id: "user-1",
  email: "demo@example.com",
  passwordHash: "hash",
  timezone: "Asia/Shanghai",
  emailVerifiedAt: new Date("2026-06-01T00:00:00Z"),
  createdAt: new Date(),
  updatedAt: new Date()
};

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    vi.clearAllMocks();
    vi.mocked(verifyPassword).mockReturnValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
  });

  it("returns 401 for invalid credentials", async () => {
    vi.mocked(verifyPassword).mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "demo@example.com", password: "wrong" })
      })
    );

    expect(response.status).toBe(401);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("issues a token pair and returns it in the response body", async () => {
    vi.mocked(createSession).mockResolvedValue({
      accessToken: "access-123",
      refreshToken: "refresh-456",
      accessExpiresAt: new Date("2026-06-29T15:00:00Z"),
      refreshExpiresAt: new Date("2026-07-29T15:00:00Z")
    });

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "demo@example.com", password: "correct" })
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.accessToken).toBe("access-123");
    expect(body.refreshToken).toBe("refresh-456");
    expect(body.accessExpiresAt).toBe("2026-06-29T15:00:00.000Z");
  });

  it("allows a legacy pending account to sign in with the correct password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...user, emailVerifiedAt: null } as never);
    vi.mocked(createSession).mockResolvedValue({
      accessToken: "legacy-access",
      refreshToken: "legacy-refresh",
      accessExpiresAt: new Date("2026-08-07T16:00:00Z"),
      refreshExpiresAt: new Date("2026-09-07T16:00:00Z")
    });

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "demo@example.com", password: "correct" })
      })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).accessToken).toBe("legacy-access");
    expect(createSession).toHaveBeenCalledWith("user-1");
  });

  it("normalizes email to lowercase before lookup", async () => {
    vi.mocked(createSession).mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      accessExpiresAt: new Date(),
      refreshExpiresAt: new Date()
    });

    await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "Demo@Example.com", password: "correct" })
      })
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "demo@example.com" } });
  });

  it("rate limits repeated attempts against the same account", async () => {
    vi.mocked(verifyPassword).mockReturnValue(false);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "x-forwarded-for": `192.0.2.${attempt + 1}` },
          body: JSON.stringify({ email: "demo@example.com", password: "wrong" })
        })
      );
      expect(response.status).toBe(401);
    }

    const blocked = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": "192.0.2.99" },
        body: JSON.stringify({ email: "demo@example.com", password: "wrong" })
      })
    );

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(5);
  });
});
