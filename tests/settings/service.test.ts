import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { defaultDataMcpConnections } from "@/src/settings/defaults";
import { encryptApiKey } from "@/src/settings/crypto";
import { loadUserSettings, saveUserSettings, testUserSettings } from "@/src/settings/service";

vi.mock("@/src/db/client", () => ({
  prisma: {
    userSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

describe("settings service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SETTINGS_ENCRYPTION_KEY", "12345678901234567890123456789012");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns default settings when a user has not saved settings", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);

    const settings = await loadUserSettings("user-1");

    expect(settings.modelProvider).toBe("openai");
    expect(settings.hasApiKey).toBe(false);
    expect(settings.dataMcpConnections).toHaveLength(3);
  });

  it("preserves the existing API key when a save request leaves apiKey blank", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      encryptedApiKey: "encrypted",
      apiKeyIv: "iv",
      apiKeyTag: "tag",
      apiKeyHint: "sk-...1234"
    } as never);
    vi.mocked(prisma.userSettings.upsert).mockResolvedValue({} as never);

    await saveUserSettings("user-1", {
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "https://api.openai.com/v1",
      apiKey: "",
      dataMcpConnections: [
        {
          id: "coros",
          label: "COROS",
          enabled: true,
          serverName: "coros",
          capabilityName: "daily-health",
          endpoint: "",
          notes: ""
        }
      ]
    });

    expect(prisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          encryptedApiKey: "encrypted",
          apiKeyHint: "sk-...1234"
        })
      })
    );
  });

  it("accepts Chinese model providers when saving settings", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.userSettings.upsert).mockResolvedValue({} as never);

    await saveUserSettings("user-1", {
      modelProvider: "deepseek",
      modelName: "deepseek-v4-flash",
      modelBaseUrl: "https://api.deepseek.com",
      apiKey: "",
      dataMcpConnections: defaultDataMcpConnections
    });

    expect(prisma.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          modelProvider: "deepseek",
          modelName: "deepseek-v4-flash",
          modelBaseUrl: "https://api.deepseek.com"
        })
      })
    );
  });

  it("tests Chinese model providers through chat completions", async () => {
    const encrypted = encryptApiKey("sk-deepseek-test");
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      modelProvider: "deepseek",
      modelName: "deepseek-v4-flash",
      modelBaseUrl: "",
      encryptedApiKey: encrypted.encryptedApiKey,
      apiKeyIv: encrypted.apiKeyIv,
      apiKeyTag: encrypted.apiKeyTag,
      apiKeyHint: encrypted.apiKeyHint,
      dataMcpConnectionsJson: JSON.stringify(defaultDataMcpConnections)
    } as never);
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as never);

    const results = await testUserSettings("user-1", "model");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-deepseek-test",
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }]
        })
      })
    );
    expect(results).toEqual([
      expect.objectContaining({
        id: "model",
        status: "connected",
        message: "DeepSeek model deepseek-v4-flash responded."
      })
    ]);
  });

  it("tests custom model providers through the same chat completions endpoint used by agent chat", async () => {
    const encrypted = encryptApiKey("sk-custom-test");
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      modelProvider: "custom",
      modelName: "custom-chat-model",
      modelBaseUrl: "https://llm.example.test/v1",
      encryptedApiKey: encrypted.encryptedApiKey,
      apiKeyIv: encrypted.apiKeyIv,
      apiKeyTag: encrypted.apiKeyTag,
      apiKeyHint: encrypted.apiKeyHint,
      dataMcpConnectionsJson: JSON.stringify(defaultDataMcpConnections)
    } as never);
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as never);

    const results = await testUserSettings("user-1", "model");

    expect(fetch).toHaveBeenCalledWith(
      "https://llm.example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-custom-test",
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          model: "custom-chat-model",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }]
        })
      })
    );
    expect(results).toEqual([
      expect.objectContaining({
        id: "model",
        status: "connected",
        message: "Custom model custom-chat-model responded."
      })
    ]);
  });

  it("tests a draft API key without requiring saved settings", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as never);

    const results = await testUserSettings("user-1", "model", {
      modelProvider: "deepseek",
      modelName: "deepseek-v4-flash",
      modelBaseUrl: "",
      apiKey: "sk-draft-test",
      dataMcpConnections: defaultDataMcpConnections
    } as never);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sk-draft-test"
        })
      })
    );
    expect(results).toEqual([
      expect.objectContaining({
        id: "model",
        status: "connected"
      })
    ]);
    expect(prisma.userSettings.upsert).not.toHaveBeenCalled();
  });

  it("reports model as not configured when no key is saved", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);

    const results = await testUserSettings("user-1", "model");

    expect(results).toEqual([
      expect.objectContaining({
        id: "model",
        status: "not_configured"
      })
    ]);
  });

  it("reports enabled MCP descriptors as connected without endpoint network checks", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);

    const results = await testUserSettings("user-1", "coros");

    expect(results).toEqual([
      expect.objectContaining({
        id: "coros",
        status: "connected"
      })
    ]);
  });
});
