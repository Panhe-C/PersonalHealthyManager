import { describe, expect, it } from "vitest";
import { buildFeishuAuthorizeUrl, feishuOAuthConfigured } from "@/src/providers/feishu-calendar-oauth";

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
});
