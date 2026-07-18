import { describe, expect, it } from "vitest";
import { mcpConnectionStatus } from "./settingsStatus";

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
