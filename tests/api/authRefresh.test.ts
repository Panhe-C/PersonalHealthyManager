import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/session", () => ({
  refreshSession: vi.fn()
}));

import { POST } from "@/app/api/auth/refresh/route";
import { refreshSession } from "@/src/auth/session";

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when refreshToken is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(400);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid body", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/refresh", {
        method: "POST",
        body: "not-json"
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 401 when the refresh token is invalid or expired", async () => {
    vi.mocked(refreshSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "stale" })
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid or expired refresh token", code: "invalid_refresh" });
  });

  it("returns a new token pair on success", async () => {
    vi.mocked(refreshSession).mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      accessExpiresAt: new Date("2026-06-29T15:00:00Z"),
      refreshExpiresAt: new Date("2026-07-29T15:00:00Z")
    });

    const response = await POST(
      new Request("http://localhost/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "valid" })
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.accessToken).toBe("new-access");
    expect(body.refreshToken).toBe("new-refresh");
    expect(body.accessExpiresAt).toBe("2026-06-29T15:00:00.000Z");
  });
});
