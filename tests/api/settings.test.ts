import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as OAUTH_CALLBACK_GET } from "@/app/api/settings/mcp/oauth/callback/route";
import { GET as OAUTH_START_GET } from "@/app/api/settings/mcp/oauth/start/route";
import { GET, POST } from "@/app/api/settings/route";
import { POST as TEST_POST } from "@/app/api/settings/test/route";
import {
  createMcpOAuthAuthorizationUrl,
  handleMcpOAuthCallback,
  loadUserSettings,
  saveUserSettings,
  testUserSettings
} from "@/src/settings/service";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

vi.mock("@/src/settings/service", () => ({
  createMcpOAuthAuthorizationUrl: vi.fn(),
  handleMcpOAuthCallback: vi.fn(),
  loadUserSettings: vi.fn(),
  saveUserSettings: vi.fn(),
  testUserSettings: vi.fn()
}));

describe("settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads settings for the authenticated user", async () => {
    vi.mocked(loadUserSettings).mockResolvedValue({
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "",
      hasApiKey: false,
      apiKeyHint: null,
      dataMcpConnections: []
    });

    const response = await GET(new Request("http://localhost/api/settings"));

    expect(await response.json()).toEqual(expect.objectContaining({ modelProvider: "openai" }));
    expect(loadUserSettings).toHaveBeenCalledWith("user-1");
  });

  it("saves settings and returns the sanitized view", async () => {
    vi.mocked(saveUserSettings).mockResolvedValue({
      modelProvider: "openai",
      modelName: "gpt-4o-mini",
      modelBaseUrl: "",
      hasApiKey: true,
      apiKeyHint: "sk-...1234",
      dataMcpConnections: []
    });

    const response = await POST(
      new Request("http://localhost/api/settings", { method: "POST", body: JSON.stringify({ modelProvider: "openai" }) })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("apiKey");
  });

  it("runs settings tests for a requested target", async () => {
    vi.mocked(testUserSettings).mockResolvedValue([
      { id: "model", label: "Model", status: "not_configured", message: "Missing API key", latencyMs: null }
    ]);

    const response = await TEST_POST(
      new Request("http://localhost/api/settings/test", { method: "POST", body: JSON.stringify({ target: "model" }) })
    );

    expect(await response.json()).toEqual({ results: [expect.objectContaining({ id: "model" })] });
  });

  it("starts MCP OAuth by redirecting to the provider authorization URL", async () => {
    vi.mocked(createMcpOAuthAuthorizationUrl).mockResolvedValue(new URL("https://login.example.test/oauth/authorize?state=state-1"));

    const response = await OAUTH_START_GET(new Request("http://localhost/api/settings/mcp/oauth/start?connection=coros"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://login.example.test/oauth/authorize?state=state-1");
    expect(createMcpOAuthAuthorizationUrl).toHaveBeenCalledWith("user-1", "coros", "http://localhost");
  });

  it("handles MCP OAuth callback and redirects back to Settings", async () => {
    vi.mocked(handleMcpOAuthCallback).mockResolvedValue("coros");

    const response = await OAUTH_CALLBACK_GET(
      new Request("http://localhost/api/settings/mcp/oauth/callback?code=code-1&state=state-1")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/settings?mcp=coros&auth=connected");
    expect(handleMcpOAuthCallback).toHaveBeenCalledWith("user-1", {
      code: "code-1",
      state: "state-1",
      origin: "http://localhost"
    });
  });
});
