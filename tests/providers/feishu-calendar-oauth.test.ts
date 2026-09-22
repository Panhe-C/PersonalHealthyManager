import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFeishuAuthorizeUrl,
  exchangeFeishuCode,
  feishuOAuthConfigured
} from "@/src/providers/feishu-calendar-oauth";

describe("feishu calendar oauth", () => {
  it("reports when app credentials are missing", () => {
    expect(feishuOAuthConfigured({})).toBe(false);
    expect(
      feishuOAuthConfigured({ HBM_FEISHU_APP_ID: "cli_x", HBM_FEISHU_APP_SECRET: "secret" })
    ).toBe(true);
  });

  it("builds an authorize URL with the app id and redirect", () => {
    process.env.HBM_FEISHU_APP_ID = "cli_demo";
    process.env.HBM_FEISHU_APP_SECRET = "secret";
    const url = buildFeishuAuthorizeUrl({
      redirectUri: "https://hbm.example.com/api/settings/feishu/oauth/callback",
      state: "abc"
    });
    expect(url.searchParams.get("app_id")).toBe("cli_demo");
    expect(url.searchParams.get("state")).toBe("abc");
    expect(url.searchParams.get("redirect_uri")).toContain("/api/settings/feishu/oauth/callback");
    delete process.env.HBM_FEISHU_APP_ID;
    delete process.env.HBM_FEISHU_APP_SECRET;
  });

  describe("exchangeFeishuCode", () => {
    beforeEach(() => {
      process.env.HBM_FEISHU_APP_ID = "cli_demo";
      process.env.HBM_FEISHU_APP_SECRET = "secret";
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      delete process.env.HBM_FEISHU_APP_ID;
      delete process.env.HBM_FEISHU_APP_SECRET;
    });

    function mockTokenResponse(status: number, body: unknown) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify(body), { status }))
      );
    }

    it("accepts a v2 success response without a code field", async () => {
      mockTokenResponse(200, {
        token_type: "Bearer",
        access_token: "u-access",
        refresh_token: "u-refresh",
        expires_in: 7200
      });
      const tokens = await exchangeFeishuCode({ code: "auth-code", redirectUri: "https://hbm.example.com/cb" });
      expect(tokens).toEqual({ accessToken: "u-access", refreshToken: "u-refresh", expiresIn: 7200 });
    });

    it("accepts a success response that includes code: 0", async () => {
      mockTokenResponse(200, { code: 0, access_token: "u-access", expires_in: 7200 });
      const tokens = await exchangeFeishuCode({ code: "auth-code", redirectUri: "https://hbm.example.com/cb" });
      expect(tokens.accessToken).toBe("u-access");
    });

    it("rejects an error response and surfaces the provider message", async () => {
      mockTokenResponse(200, { code: 20003, error: "invalid_grant", error_description: "code expired" });
      await expect(
        exchangeFeishuCode({ code: "bad-code", redirectUri: "https://hbm.example.com/cb" })
      ).rejects.toThrow("code expired");
    });
  });
});
