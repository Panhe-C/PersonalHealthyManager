import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        apiBaseUrl: "http://localhost:3000"
      }
    }
  }
}));

const tokenStore = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setTokens: vi.fn(),
  resetTokens: vi.fn()
}));

vi.mock("../auth/tokenStore", () => ({
  getAccessToken: tokenStore.getAccessToken,
  getRefreshToken: tokenStore.getRefreshToken,
  setTokens: tokenStore.setTokens,
  resetTokens: tokenStore.resetTokens
}));

import { api } from "./client";

describe("mobile API client auth login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.getAccessToken.mockResolvedValue(null);
    tokenStore.getRefreshToken.mockReturnValue(null);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("surfaces invalid login credentials instead of treating login 401 as an expired session", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Invalid email or password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(api.auth.login("", "")).rejects.toThrow("Invalid email or password");
    expect(tokenStore.getRefreshToken).not.toHaveBeenCalled();
    expect(tokenStore.resetTokens).not.toHaveBeenCalled();
  });
});
