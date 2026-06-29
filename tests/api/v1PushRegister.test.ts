import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

const { registerPushToken } = vi.hoisted(() => ({ registerPushToken: vi.fn() }));

vi.mock("@/src/services/pushService", () => ({ registerPushToken }));

import { POST } from "@/app/api/v1/push/register/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/v1/push/register", () => {
  it("returns 400 when token is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/push/register", { method: "POST", body: JSON.stringify({}) })
    );
    expect(response.status).toBe(400);
    expect(registerPushToken).not.toHaveBeenCalled();
  });

  it("registers the token with default ios platform", async () => {
    registerPushToken.mockResolvedValue({ id: "pt-1" });
    const response = await POST(
      new Request("http://localhost/api/v1/push/register", {
        method: "POST",
        body: JSON.stringify({ token: "ExponentPushToken[abc]" })
      })
    );
    expect(response.status).toBe(200);
    expect(registerPushToken).toHaveBeenCalledWith("user-1", "ExponentPushToken[abc]", "ios");
    expect(await response.json()).toEqual({ ok: true, id: "pt-1" });
  });

  it("accepts an explicit platform", async () => {
    registerPushToken.mockResolvedValue({ id: "pt-2" });
    await POST(
      new Request("http://localhost/api/v1/push/register", {
        method: "POST",
        body: JSON.stringify({ token: "ExponentPushToken[xyz]", platform: "android" })
      })
    );
    expect(registerPushToken).toHaveBeenCalledWith("user-1", "ExponentPushToken[xyz]", "android");
  });
});
