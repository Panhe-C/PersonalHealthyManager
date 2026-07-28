import { describe, expect, it } from "vitest";
import { mcpConnectionStatus, oauthConnectionDetail } from "./settingsStatus";

describe("mcpConnectionStatus", () => {
  it("reports COROS from the saved OAuth token state", () => {
    expect(mcpConnectionStatus({
      id: "coros",
      label: "COROS",
      enabled: true,
      endpoint: "https://mcp.example.test",
      auth: { type: "oauth2", accessTokenHint: "...1234" }
    })).toBe("已连接");
  });

  it("does not claim an unconfigured connection is connected", () => {
    expect(mcpConnectionStatus({ id: "calendar", label: "Calendar", enabled: true, endpoint: "", auth: { type: "none" } })).toBe("未配置");
  });

  it("requires a saved session for local Meal Menu", () => {
    expect(mcpConnectionStatus({
      id: "meal_menu",
      label: "Meal Menu",
      enabled: true,
      endpoint: "",
      transport: "stdio",
      auth: { type: "none" }
    })).toBe("需要会话");
  });
});

describe("oauthConnectionDetail", () => {
  const coros = (auth: { type: "oauth2" | "bearer"; accessTokenHint?: string; expiresAt?: string }) => ({
    id: "coros" as const,
    label: "COROS",
    enabled: true,
    endpoint: "https://mcpcn.coros.com/mcp",
    auth
  });

  it("says nothing for connections that do not use OAuth", () => {
    expect(oauthConnectionDetail(coros({ type: "bearer" }))).toBe("");
  });

  it("reports a connection that has never been authorized", () => {
    expect(oauthConnectionDetail(coros({ type: "oauth2" }))).toContain("尚未授权");
  });

  it("reports a live authorization with its expiry", () => {
    const detail = oauthConnectionDetail(
      coros({ type: "oauth2", accessTokenHint: "...1234", expiresAt: "2026-08-01T00:00:00.000Z" }),
      new Date("2026-07-27T00:00:00.000Z")
    );
    expect(detail).toContain("已授权 ...1234");
    expect(detail).toContain("到期");
  });

  it("flags an expired authorization instead of claiming it is connected", () => {
    const detail = oauthConnectionDetail(
      coros({ type: "oauth2", accessTokenHint: "...1234", expiresAt: "2026-07-01T00:00:00.000Z" }),
      new Date("2026-07-27T00:00:00.000Z")
    );
    expect(detail).toContain("过期");
    expect(detail).toContain("重新授权");
  });

  it("still reports authorization when the server omits an expiry", () => {
    expect(oauthConnectionDetail(coros({ type: "oauth2", accessTokenHint: "...1234" }))).toBe("已授权 ...1234");
  });
});
