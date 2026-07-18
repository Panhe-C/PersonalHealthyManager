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

import { saveSettings, type MobileSettings } from "./settings";

const settings: MobileSettings = {
  modelProvider: "openai",
  modelName: "gpt-4o-mini",
  modelBaseUrl: "https://api.openai.com/v1",
  hasApiKey: true,
  apiKeyHint: "sk-…1234",
  dataMcpConnections: [{
    id: "calendar",
    label: "Calendar",
    enabled: true,
    endpoint: "https://mcp.example/calendar",
    transport: "http",
    auth: { type: "bearer", tokenHint: "…5678" }
  }]
};

describe("mobile settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.getAccessToken.mockResolvedValue("access-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("saves model and connection settings through the authenticated v1 API", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(settings), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));

    await saveSettings(settings, "new-secret-key");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/settings",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          modelProvider: settings.modelProvider,
          modelName: settings.modelName,
          modelBaseUrl: settings.modelBaseUrl,
          apiKey: "new-secret-key",
          dataMcpConnections: settings.dataMcpConnections
        })
      })
    );
  });
});
