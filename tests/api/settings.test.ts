import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/settings/route";
import { POST as TEST_POST } from "@/app/api/settings/test/route";
import { loadUserSettings, saveUserSettings, testUserSettings } from "@/src/settings/service";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

vi.mock("@/src/settings/service", () => ({
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
});
