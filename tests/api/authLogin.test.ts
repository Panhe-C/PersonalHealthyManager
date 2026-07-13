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

const user = {
  id: "user-1",
  email: "demo@example.com",
  passwordHash: "hash",
  timezone: "Asia/Shanghai",
  createdAt: new Date(),
  updatedAt: new Date()
};

describe("POST /api/auth/login", () => {
  beforeEach(() => {
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
});
