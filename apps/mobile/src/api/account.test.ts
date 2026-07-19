import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { apiBaseUrl: "http://localhost:3000" } } }
}));

const tokenStore = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setTokens: vi.fn(),
  resetTokens: vi.fn()
}));

vi.mock("../auth/tokenStore", () => tokenStore);

import { deleteAccount } from "./account";

describe("mobile account API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.getAccessToken.mockResolvedValue("access-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sends the current password in an authenticated DELETE request", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));

    await expect(deleteAccount("current-password")).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/account",
      expect.objectContaining({ method: "DELETE", body: JSON.stringify({ password: "current-password" }) })
    );
  });
});
