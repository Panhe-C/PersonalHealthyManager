import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { defaultDataMcpConnections } from "@/src/settings/defaults";
import { encryptApiKey } from "@/src/settings/crypto";
import { createMcpOAuthAuthorizationUrl, handleMcpOAuthCallback, loadUserSettings, saveUserSettings, testUserSettings } from "@/src/settings/service";

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

  it("saves MCP bearer credentials encrypted and returns only a sanitized hint", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.userSettings.upsert).mockResolvedValue({} as never);

    const settings = await saveUserSettings("user-1", {
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "https://api.openai.com/v1",
      apiKey: "",
      dataMcpConnections: [
        {
          ...defaultDataMcpConnections[0],
          endpoint: "https://mcp.example.test/coros",
          auth: { type: "bearer", token: "coros-token-123456" }
        }
      ]
    });

    const [upsertArg] = vi.mocked(prisma.userSettings.upsert).mock.calls.at(0) ?? [];
    const savedConnections = JSON.parse(String(upsertArg?.create?.dataMcpConnectionsJson ?? upsertArg?.update?.dataMcpConnectionsJson));
    expect(savedConnections[0].auth.token).toBeUndefined();
    expect(savedConnections[0].auth.encryptedToken).toEqual(expect.any(String));
    expect(savedConnections[0].auth.tokenHint).toBe("...3456");

    expect(settings.dataMcpConnections[0].auth).toEqual({
      type: "bearer",
      tokenHint: "...3456"
    });
  });

  it("uses configured MCP bearer credentials when testing an endpoint", async () => {
    const saved = await saveUserSettings("user-1", {
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "https://api.openai.com/v1",
      apiKey: "",
      dataMcpConnections: [
        {
          ...defaultDataMcpConnections[0],
          endpoint: "https://mcp.example.test/coros",
          auth: { type: "bearer", token: "coros-token-123456" }
        }
      ]
    });
    const [upsertArg] = vi.mocked(prisma.userSettings.upsert).mock.calls.at(0) ?? [];
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "https://api.openai.com/v1",
      encryptedApiKey: null,
      apiKeyIv: null,
      apiKeyTag: null,
      apiKeyHint: null,
      dataMcpConnectionsJson: String(upsertArg?.create?.dataMcpConnectionsJson ?? upsertArg?.update?.dataMcpConnectionsJson)
    } as never);
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as never);

    const results = await testUserSettings("user-1", saved.dataMcpConnections[0].id);

    expect(fetch).toHaveBeenCalledWith(
      "https://mcp.example.test/coros",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer coros-token-123456"
        })
      })
    );
    expect(results).toEqual([expect.objectContaining({ id: "coros", status: "connected" })]);
  });

  it("creates an OAuth authorization URL and stores callback state", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "https://api.openai.com/v1",
      encryptedApiKey: null,
      apiKeyIv: null,
      apiKeyTag: null,
      apiKeyHint: null,
      dataMcpConnectionsJson: JSON.stringify([
        {
          ...defaultDataMcpConnections[0],
          auth: {
            type: "oauth2",
            authorizeUrl: "https://login.example.test/oauth/authorize",
            tokenUrl: "https://login.example.test/oauth/token",
            clientId: "client-1",
            scopes: "sleep recovery"
          }
        }
      ])
    } as never);
    vi.mocked(prisma.userSettings.upsert).mockResolvedValue({} as never);

    const url = await createMcpOAuthAuthorizationUrl("user-1", "coros", "http://localhost:3001/settings");

    expect(url.origin).toBe("https://login.example.test");
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("scope")).toBe("sleep recovery");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3001/api/settings/mcp/oauth/callback");
    expect(url.searchParams.get("state")).toEqual(expect.any(String));

    const [upsertArg] = vi.mocked(prisma.userSettings.upsert).mock.calls.at(0) ?? [];
    const savedConnections = JSON.parse(String(upsertArg?.update?.dataMcpConnectionsJson));
    expect(savedConnections[0].auth.oauthState).toBe(url.searchParams.get("state"));
  });

  it("exchanges an OAuth callback code and stores encrypted returned tokens", async () => {
    const state = "state-123";
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "https://api.openai.com/v1",
      encryptedApiKey: null,
      apiKeyIv: null,
      apiKeyTag: null,
      apiKeyHint: null,
      dataMcpConnectionsJson: JSON.stringify([
        {
          ...defaultDataMcpConnections[0],
          auth: {
            type: "oauth2",
            tokenUrl: "https://login.example.test/oauth/token",
            clientId: "client-1",
            scopes: "sleep recovery",
            oauthState: state
          }
        }
      ])
    } as never);
    vi.mocked(prisma.userSettings.upsert).mockResolvedValue({} as never);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "access-token-abcdef",
        refresh_token: "refresh-token-ghijkl",
        expires_in: 3600
      })
    } as never);

    await handleMcpOAuthCallback("user-1", {
      code: "oauth-code",
      state,
      origin: "http://localhost:3001"
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://login.example.test/oauth/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/x-www-form-urlencoded" }),
        body: expect.stringContaining("code=oauth-code")
      })
    );

    const [upsertArg] = vi.mocked(prisma.userSettings.upsert).mock.calls.at(0) ?? [];
    const savedConnections = JSON.parse(String(upsertArg?.update?.dataMcpConnectionsJson));
    expect(savedConnections[0].auth.accessToken).toBeUndefined();
    expect(savedConnections[0].auth.encryptedAccessToken).toEqual(expect.any(String));
    expect(savedConnections[0].auth.accessTokenHint).toBe("...cdef");
    expect(savedConnections[0].auth.refreshTokenHint).toBe("...ijkl");
    expect(savedConnections[0].auth.oauthState).toBeUndefined();
  });
});
