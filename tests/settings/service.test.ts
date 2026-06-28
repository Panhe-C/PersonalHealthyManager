/** @vitest-environment node */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { defaultDataMcpConnections } from "@/src/settings/defaults";
import { encryptApiKey } from "@/src/settings/crypto";
import {
  buildDataMcpStdioEnv,
  createMcpOAuthAuthorizationUrl,
  handleMcpOAuthCallback,
  loadUserSettings,
  prepareCorosMcpConnectionForOAuth,
  resolveMcpOAuthState,
  saveUserSettings,
  testUserSettings
} from "@/src/settings/service";

vi.mock("@/src/db/client", () => ({
  prisma: {
    userSettings: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
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
          auth: { type: "none" },
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

  it("saves and loads a Data MCP login URL", async () => {
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
          loginUrl: "https://coros.example.test/login"
        }
      ]
    });

    const [upsertArg] = vi.mocked(prisma.userSettings.upsert).mock.calls.at(0) ?? [];
    const savedConnections = JSON.parse(String(upsertArg?.create?.dataMcpConnectionsJson ?? upsertArg?.update?.dataMcpConnectionsJson));
    expect(savedConnections[0].loginUrl).toBe("https://coros.example.test/login");
    expect(settings.dataMcpConnections[0].loginUrl).toBe("https://coros.example.test/login");
  });

  it("saves Meal Menu local command settings and masks the LARK session", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.userSettings.upsert).mockImplementation(async (input) => {
      const data = "create" in input ? input.create : input.update;
      return {
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        modelBaseUrl: "https://api.openai.com/v1",
        encryptedApiKey: null,
        apiKeyIv: null,
        apiKeyTag: null,
        apiKeyHint: null,
        dataMcpConnectionsJson: data.dataMcpConnectionsJson
      } as never;
    });

    const settings = await saveUserSettings("user-1", {
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "https://api.openai.com/v1",
      apiKey: "",
      dataMcpConnections: [
        defaultDataMcpConnections[0],
        defaultDataMcpConnections[1],
        {
          ...defaultDataMcpConnections[2],
          transport: "stdio",
          command: "npx",
          args: "-y @byted/mcp-bytecanteen@latest",
          larkSession: "session-cookie-123456",
          canteenName: "北京融中心"
        }
      ]
    });

    const savedConnections = JSON.parse(String(vi.mocked(prisma.userSettings.upsert).mock.calls[0][0].create.dataMcpConnectionsJson));
    expect(savedConnections[2]).toEqual(
      expect.objectContaining({
        transport: "stdio",
        command: "npx",
        args: "-y @byted/mcp-bytecanteen@latest",
        canteenName: "北京融中心",
        larkSessionHint: "...3456"
      })
    );
    expect(savedConnections[2].larkSession).toBeUndefined();
    expect(savedConnections[2].encryptedLarkSession).toEqual(expect.any(String));
    expect(settings.dataMcpConnections[2]).toEqual(
      expect.objectContaining({
        transport: "stdio",
        command: "npx",
        args: "-y @byted/mcp-bytecanteen@latest",
        canteenName: "北京融中心",
        larkSessionHint: "...3456"
      })
    );
    expect(settings.dataMcpConnections[2].larkSession).toBeUndefined();
    expect(settings.dataMcpConnections[2].encryptedLarkSession).toBeUndefined();
    expect(buildDataMcpStdioEnv(savedConnections[2])).toEqual({
      LARK_SESSION: "session-cookie-123456"
    });
  });

  it("requires LARK_SESSION before testing a local Meal Menu MCP command", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({
      dataMcpConnectionsJson: JSON.stringify([
        defaultDataMcpConnections[0],
        defaultDataMcpConnections[1],
        {
          ...defaultDataMcpConnections[2],
          transport: "stdio",
          command: "npx",
          args: "-y @byted/mcp-bytecanteen@latest"
        }
      ])
    } as never);

    const results = await testUserSettings("user-1", "meal_menu");

    expect(results).toEqual([
      expect.objectContaining({
        id: "meal_menu",
        status: "auth_required",
        message: "Meal Menu LARK_SESSION is required before the local MCP command can be tested."
      })
    ]);
  });

  it("saves and loads the selected COROS MCP region", async () => {
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
          corosRegion: "eu",
          endpoint: "https://mcpeu.coros.com/mcp"
        }
      ]
    });

    const [upsertArg] = vi.mocked(prisma.userSettings.upsert).mock.calls.at(0) ?? [];
    const savedConnections = JSON.parse(String(upsertArg?.create?.dataMcpConnectionsJson ?? upsertArg?.update?.dataMcpConnectionsJson));
    expect(savedConnections[0].corosRegion).toBe("eu");
    expect(savedConnections[0].endpoint).toBe("https://mcpeu.coros.com/mcp");
    expect(settings.dataMcpConnections[0].corosRegion).toBe("eu");
  });

  it("rejects malformed Data MCP login URLs", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);

    await expect(
      saveUserSettings("user-1", {
        modelProvider: "openai",
        modelName: "gpt-4o-mini",
        modelBaseUrl: "https://api.openai.com/v1",
        apiKey: "",
        dataMcpConnections: [
          {
            ...defaultDataMcpConnections[0],
            loginUrl: "not-a-url"
          }
        ]
      })
    ).rejects.toThrow("COROS login URL must be a valid URL");
  });

  it("uses configured MCP bearer credentials to initialize an HTTP MCP endpoint", async () => {
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
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: vi.fn().mockResolvedValue(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } }))
    } as never);

    const results = await testUserSettings("user-1", saved.dataMcpConnections[0].id);

    expect(fetch).toHaveBeenCalledWith(
      "https://mcp.example.test/coros",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json, text/event-stream",
          Authorization: "Bearer coros-token-123456"
        }),
        body: expect.stringContaining('"method":"initialize"')
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
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3001/api/settings/mcp/oauth/callback");
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
          endpoint: "https://mcpcn.coros.com/mcp",
          auth: {
            type: "oauth2",
            tokenUrl: "https://login.example.test/oauth/token",
            clientId: "client-1",
            scopes: "sleep recovery",
            oauthState: state,
            oauthCodeVerifier: "test-verifier-012345678901234567890123456789012",
            authorizeUrl: "https://login.example.test/oauth/authorize"
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
        body: expect.stringMatching(/(^|&)code=oauth-code(&|$)/)
      })
    );
    const tokenInit = vi.mocked(fetch).mock.calls.find((call) => call[0] === "https://login.example.test/oauth/token")?.[1] as {
      body?: string;
    };
    expect(tokenInit?.body).toContain("code_verifier=test-verifier-012345678901234567890123456789012");
    expect(tokenInit?.body).toContain("resource=https%3A%2F%2Fmcpcn.coros.com%2Fmcp");

    const [upsertArg] = vi.mocked(prisma.userSettings.upsert).mock.calls.at(0) ?? [];
    const savedConnections = JSON.parse(String(upsertArg?.update?.dataMcpConnectionsJson));
    expect(savedConnections[0].auth.accessToken).toBeUndefined();
    expect(savedConnections[0].auth.encryptedAccessToken).toEqual(expect.any(String));
    expect(savedConnections[0].auth.accessTokenHint).toBe("...cdef");
    expect(savedConnections[0].auth.refreshTokenHint).toBe("...ijkl");
    expect(savedConnections[0].auth.oauthState).toBeUndefined();
    expect(savedConnections[0].auth.oauthCodeVerifier).toBeUndefined();
  });

  it("registers a COROS OAuth client and adds PKCE when starting login against official endpoints", async () => {
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
          corosRegion: "us",
          endpoint: "https://mcpus.coros.com/mcp",
          auth: { type: "none" }
        }
      ])
    } as never);
    vi.mocked(prisma.userSettings.upsert).mockResolvedValue({} as never);

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "https://mcpus.coros.com/mcp") {
        return { ok: false, status: 404, text: async () => "" } as Response;
      }
      if (url === "https://mcpus.coros.com/.well-known/oauth-authorization-server") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            authorization_endpoint: "https://mcpus.coros.com/oauth2/authorize",
            token_endpoint: "https://mcpus.coros.com/oauth2/token",
            registration_endpoint: "https://mcpus.coros.com/connect/register"
          })
        } as Response;
      }
      if (url === "https://mcpus.coros.com/connect/register") {
        expect(init?.method).toBe("POST");
        return {
          ok: true,
          status: 201,
          json: async () => ({ client_id: "dynamic-coros-client-1" })
        } as Response;
      }
      return { ok: false, status: 500, text: async () => "unexpected fetch " + url } as Response;
    });

    const url = await createMcpOAuthAuthorizationUrl("user-1", "coros", "http://localhost:3000");

    expect(url.hostname).toBe("mcpus.coros.com");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe("dynamic-coros-client-1");
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3000/api/settings/mcp/oauth/callback");
    expect(url.searchParams.get("scope")).toBe("openid mcp.tools offline_access");
    expect(url.searchParams.get("resource")).toBe("https://mcpus.coros.com/mcp");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const codeChallenge = url.searchParams.get("code_challenge");
    expect(codeChallenge).toBeTruthy();

    const [upsertArg] = vi.mocked(prisma.userSettings.upsert).mock.calls.at(-1) ?? [];
    const savedConnections = JSON.parse(String(upsertArg?.update?.dataMcpConnectionsJson));
    expect(savedConnections[0].auth.type).toBe("oauth2");
    expect(savedConnections[0].auth.clientId).toBe("dynamic-coros-client-1");
    expect(savedConnections[0].auth.oauthRegisteredRedirectUri).toBe("http://127.0.0.1:3000/api/settings/mcp/oauth/callback");
    expect(savedConnections[0].auth.corosOAuthRegistrationVersion).toBe(3);
    expect(savedConnections[0].auth.oauthReturnOrigin).toBe("http://localhost:3000");
    const verifier = String(savedConnections[0].auth.oauthCodeVerifier);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    const expectedChallenge = createHash("sha256")
      .update(verifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(codeChallenge).toBe(expectedChallenge);
  });

  it("prepareCorosMcpConnectionForOAuth updates endpoint and region without wiping OAuth2 auth", async () => {
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
          endpoint: "https://mcpus.coros.com/mcp",
          corosRegion: "us",
          auth: {
            type: "oauth2",
            authorizeUrl: "https://mcpus.coros.com/oauth2/authorize",
            tokenUrl: "https://mcpus.coros.com/oauth2/token",
            clientId: "registered-client-preserve",
            oauthState: "stale-state-123"
          }
        },
        defaultDataMcpConnections[1],
        defaultDataMcpConnections[2]
      ])
    } as never);
    vi.mocked(prisma.userSettings.upsert).mockResolvedValue({} as never);

    await prepareCorosMcpConnectionForOAuth("user-1", {
      endpoint: "https://mcpcn.coros.com/mcp",
      corosRegion: "china"
    });

    const [upsertArg] = vi.mocked(prisma.userSettings.upsert).mock.calls.at(0) ?? [];
    const savedConnections = JSON.parse(String(upsertArg?.update?.dataMcpConnectionsJson));
    expect(savedConnections[0].endpoint).toBe("https://mcpcn.coros.com/mcp");
    expect(savedConnections[0].corosRegion).toBe("china");
    expect(savedConnections[0].auth.type).toBe("oauth2");
    expect(savedConnections[0].auth.clientId).toBe("registered-client-preserve");
    expect(savedConnections[0].auth.oauthState).toBe("stale-state-123");
  });

  it("re-registers COROS OAuth when the saved redirect URI no longer matches the current app origin", async () => {
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
          endpoint: "https://mcpus.coros.com/mcp",
          auth: {
            type: "oauth2",
            authorizeUrl: "https://mcpus.coros.com/oauth2/authorize",
            tokenUrl: "https://mcpus.coros.com/oauth2/token",
            clientId: "old-dynamic-client",
            oauthRegisteredRedirectUri: "http://localhost:3000/api/settings/mcp/oauth/callback"
          }
        },
        defaultDataMcpConnections[1],
        defaultDataMcpConnections[2]
      ])
    } as never);
    vi.mocked(prisma.userSettings.upsert).mockResolvedValue({} as never);

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "https://mcpus.coros.com/mcp") {
        return { ok: false, status: 404, text: async () => "" } as Response;
      }
      if (url === "https://mcpus.coros.com/.well-known/oauth-authorization-server") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            authorization_endpoint: "https://mcpus.coros.com/oauth2/authorize",
            token_endpoint: "https://mcpus.coros.com/oauth2/token",
            registration_endpoint: "https://mcpus.coros.com/connect/register"
          })
        } as Response;
      }
      if (url === "https://mcpus.coros.com/connect/register") {
        expect(init?.method).toBe("POST");
        return {
          ok: true,
          status: 201,
          json: async () => ({ client_id: "new-client-after-host-change" })
        } as Response;
      }
      return { ok: false, status: 500, text: async () => "unexpected fetch " + url } as Response;
    });

    const url = await createMcpOAuthAuthorizationUrl("user-1", "coros", "http://127.0.0.1:3000");

    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3000/api/settings/mcp/oauth/callback");
    expect(url.searchParams.get("client_id")).toBe("new-client-after-host-change");

    const [upsertArg] = vi.mocked(prisma.userSettings.upsert).mock.calls.at(-1) ?? [];
    const savedConnections = JSON.parse(String(upsertArg?.update?.dataMcpConnectionsJson));
    expect(savedConnections[0].auth.clientId).toBe("new-client-after-host-change");
    expect(savedConnections[0].auth.oauthRegisteredRedirectUri).toBe(
      "http://127.0.0.1:3000/api/settings/mcp/oauth/callback"
    );
    expect(savedConnections[0].auth.corosOAuthRegistrationVersion).toBe(3);
  });

  it("resolves the OAuth callback user and original origin from the state token", async () => {
    vi.mocked(prisma.userSettings.findMany).mockResolvedValue([
      {
        userId: "user-other",
        dataMcpConnectionsJson: JSON.stringify([{ ...defaultDataMcpConnections[0], auth: { type: "none" } }])
      },
      {
        userId: "user-target",
        dataMcpConnectionsJson: JSON.stringify([
          {
            ...defaultDataMcpConnections[0],
            endpoint: "https://mcpcn.coros.com/mcp",
            auth: {
              type: "oauth2",
              authorizeUrl: "https://mcpcn.coros.com/oauth2/authorize",
              tokenUrl: "https://mcpcn.coros.com/oauth2/token",
              clientId: "client-target",
              oauthState: "state-xyz",
              oauthReturnOrigin: "http://localhost:3000"
            }
          }
        ])
      }
    ] as never);

    const resolved = await resolveMcpOAuthState("state-xyz");

    expect(resolved).toEqual({ userId: "user-target", returnOrigin: "http://localhost:3000" });
  });

  it("returns null when no connection matches the OAuth state", async () => {
    vi.mocked(prisma.userSettings.findMany).mockResolvedValue([] as never);

    expect(await resolveMcpOAuthState("missing-state")).toBeNull();
  });
});
