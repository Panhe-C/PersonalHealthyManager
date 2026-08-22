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

  it("requests a password reset without an access token, since the caller is locked out", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: "reset_sent", email: "owner@example.test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(api.auth.forgotPassword("owner@example.test")).resolves.toEqual({
      ok: true,
      status: "reset_sent",
      email: "owner@example.test"
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/forgot-password",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "owner@example.test" }) })
    );
    expect(tokenStore.getRefreshToken).not.toHaveBeenCalled();
  });

  it("registers the account and then creates a login session", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, status: "registered", email: "new@example.com" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            accessToken: "access-new",
            refreshToken: "refresh-new",
            accessExpiresAt: "2026-08-07T17:00:00.000Z",
            refreshExpiresAt: "2026-09-07T17:00:00.000Z"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    await expect(api.auth.register("new@example.com", "long-enough-password", "Asia/Shanghai", true)).resolves.toEqual(
      expect.objectContaining({ accessToken: "access-new", refreshToken: "refresh-new" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/api/auth/register",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "new@example.com", password: "long-enough-password" })
      })
    );
    expect(tokenStore.setTokens).toHaveBeenCalledWith({
      accessToken: "access-new",
      refreshToken: "refresh-new",
      accessExpiresAt: "2026-08-07T17:00:00.000Z",
      refreshExpiresAt: "2026-09-07T17:00:00.000Z"
    });
  });
});
