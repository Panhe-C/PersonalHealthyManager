import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as OAUTH_CALLBACK_GET } from "@/app/api/settings/mcp/oauth/callback/route";
import { GET as OAUTH_START_GET } from "@/app/api/settings/mcp/oauth/start/route";
import { GET, POST } from "@/app/api/settings/route";
import { POST as TEST_POST } from "@/app/api/settings/test/route";
import { consumeOAuthHandoffToken } from "@/src/auth/oauthHandoff";
import { getCurrentUser } from "@/src/auth/session";
import {
  createMcpOAuthAuthorizationUrl,
  handleMcpOAuthCallback,
  loadUserSettings,
  resolveMcpOAuthState,
  saveUserSettings,
  testUserSettings
} from "@/src/settings/service";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

// The OAuth start route is entered by a browser navigation, so it resolves the
// user itself instead of going through withUser.
vi.mock("@/src/auth/session", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "user-1", timezone: "Asia/Shanghai" }))
}));

vi.mock("@/src/auth/oauthHandoff", () => ({
  consumeOAuthHandoffToken: vi.fn()
}));

vi.mock("@/src/settings/service", async (importOriginal) => ({
  // buildOAuthReturnUrl is a pure URL builder, so the routes are asserted
  // against the real redirect targets rather than a stub.
  buildOAuthReturnUrl: ((await importOriginal()) as typeof import("@/src/settings/service")).buildOAuthReturnUrl,
  createMcpOAuthAuthorizationUrl: vi.fn(),
  handleMcpOAuthCallback: vi.fn(),
  resolveMcpOAuthState: vi.fn(),
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

    const response = await GET();

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
    expect(createMcpOAuthAuthorizationUrl).toHaveBeenCalledWith("user-1", "coros", "http://localhost", "web");
  });

  it("starts MCP OAuth from the app by spending a single-use handoff token", async () => {
    vi.mocked(consumeOAuthHandoffToken).mockResolvedValue({ id: "user-app" } as never);
    vi.mocked(createMcpOAuthAuthorizationUrl).mockResolvedValue(new URL("https://login.example.test/oauth/authorize?state=state-2"));

    const response = await OAUTH_START_GET(
      new Request("http://localhost/api/settings/mcp/oauth/start?connection=coros&handoff=handoff-1")
    );

    expect(response.status).toBe(307);
    expect(consumeOAuthHandoffToken).toHaveBeenCalledWith("handoff-1");
    // The cookie session must not be consulted for an app-initiated flow.
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(createMcpOAuthAuthorizationUrl).toHaveBeenCalledWith("user-app", "coros", "http://localhost", "app");
  });

  it("returns an expired handoff to the app deep link instead of the web settings page", async () => {
    vi.mocked(consumeOAuthHandoffToken).mockResolvedValue(null);

    const response = await OAUTH_START_GET(
      new Request("http://localhost/api/settings/mcp/oauth/start?connection=coros&handoff=stale")
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location.startsWith("hbm://mcp-oauth")).toBe(true);
    expect(location).toContain("auth=failed");
    expect(createMcpOAuthAuthorizationUrl).not.toHaveBeenCalled();
  });

  it("rejects a browser start with no session at all", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null as never);

    const response = await OAUTH_START_GET(new Request("http://localhost/api/settings/mcp/oauth/start?connection=coros"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("auth=failed");
    expect(createMcpOAuthAuthorizationUrl).not.toHaveBeenCalled();
  });

  it("redirects OAuth start failures back to Settings with an error message", async () => {
    vi.mocked(createMcpOAuthAuthorizationUrl).mockRejectedValue(new Error("MCP connection is not configured for OAuth2."));

    const response = await OAUTH_START_GET(new Request("http://localhost/api/settings/mcp/oauth/start?connection=coros"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/settings?mcp=coros&auth=failed&error=MCP+connection+is+not+configured+for+OAuth2."
    );
  });

  it("handles MCP OAuth callback and redirects back to the original origin", async () => {
    vi.mocked(resolveMcpOAuthState).mockResolvedValue({ userId: "user-1", returnOrigin: "http://localhost:3000", returnTarget: "web" });
    vi.mocked(handleMcpOAuthCallback).mockResolvedValue("coros");

    const response = await OAUTH_CALLBACK_GET(
      new Request("http://127.0.0.1/api/settings/mcp/oauth/callback?code=code-1&state=state-1")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/settings?mcp=coros&auth=connected");
    expect(resolveMcpOAuthState).toHaveBeenCalledWith("state-1");
    expect(handleMcpOAuthCallback).toHaveBeenCalledWith("user-1", {
      code: "code-1",
      state: "state-1",
      origin: "http://127.0.0.1"
    });
  });

  it("returns an app-initiated callback to the deep link so the in-app browser closes", async () => {
    vi.mocked(resolveMcpOAuthState).mockResolvedValue({ userId: "user-1", returnOrigin: "http://localhost:3100", returnTarget: "app" });
    vi.mocked(handleMcpOAuthCallback).mockResolvedValue("coros");

    const response = await OAUTH_CALLBACK_GET(
      new Request("http://127.0.0.1/api/settings/mcp/oauth/callback?code=code-1&state=state-1")
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location.startsWith("hbm://mcp-oauth")).toBe(true);
    expect(location).toContain("auth=connected");
    expect(location).toContain("mcp=coros");
  });

  it("redirects to Settings with an error when the OAuth state cannot be resolved", async () => {
    vi.mocked(resolveMcpOAuthState).mockResolvedValue(null);

    const response = await OAUTH_CALLBACK_GET(
      new Request("http://127.0.0.1/api/settings/mcp/oauth/callback?code=code-1&state=unknown")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1/settings?auth=failed&error=Invalid+or+expired+OAuth+state"
    );
    expect(handleMcpOAuthCallback).not.toHaveBeenCalled();
  });
});
