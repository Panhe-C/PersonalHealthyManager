import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
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
