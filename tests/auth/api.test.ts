import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/src/auth/session";
import { withUser } from "@/src/auth/api";

vi.mock("@/src/auth/session", () => ({
  getCurrentUser: vi.fn()
}));

describe("authenticated API wrapper", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
  });

  it("returns 401 when there is no current user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const handler = withUser(async () => Response.json({ ok: true }));

    const response = await handler();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("passes the current user to the handler", async () => {
    const user = {
      id: "user-1",
      email: "demo@example.com",
      passwordHash: "hash",
      timezone: "Asia/Shanghai",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    const handler = withUser(async (currentUser) => Response.json({ id: currentUser.id }));

    const response = await handler();

    expect(await response.json()).toEqual({ id: "user-1" });
  });
});
