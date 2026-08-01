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

import { providerCredentialSource, providerModelDefaults, saveSettings, type MobileSettings } from "./settings";

const settings: MobileSettings = {
  modelProvider: "openai",
  modelName: "gpt-5.6-terra",
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

  it("leaves the model identity to the server for a hosted provider", async () => {
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
          apiKey: "new-secret-key",
          dataMcpConnections: settings.dataMcpConnections
        })
      })
    );
  });

  it("sends the model identity for the custom provider", async () => {
    const custom: MobileSettings = {
      ...settings,
      modelProvider: "custom",
      modelName: "my-relay-model",
      modelBaseUrl: "https://relay.example.test/v1"
    };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(custom), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));

    await saveSettings(custom, "new-secret-key");

    const [, requestInit] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
    expect(JSON.parse(String(requestInit?.body))).toEqual(
      expect.objectContaining({
        modelProvider: "custom",
        modelName: "my-relay-model",
        modelBaseUrl: "https://relay.example.test/v1"
      })
    );
  });

  it("mirrors the server's provider defaults so a switch previews the right model", () => {
    expect(providerModelDefaults("kimi")).toEqual({
      model: "kimi-k3",
      baseUrl: "https://api.moonshot.ai/v1"
    });
    expect(providerModelDefaults("custom")).toEqual({ model: "", baseUrl: "" });
  });

  it("names where a working key comes from before the user pastes one", () => {
    expect(providerCredentialSource("kimi")).toContain("Kimi 开放平台");
    expect(providerCredentialSource("glm")).toContain("open.bigmodel.cn");
    expect(providerCredentialSource("custom")).toBe("");
  });
});
