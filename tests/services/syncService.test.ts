import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { defaultDataMcpConnections } from "@/src/settings/defaults";
import { saveUserSettings } from "@/src/settings/service";
import { syncCorosFromSettings } from "@/src/services/syncService";

const mocks = vi.hoisted(() => {
  const tx = {
    activityRecord: { upsert: vi.fn() },
    sleepRecord: { upsert: vi.fn() },
    recoveryRecord: { upsert: vi.fn() }
  };

  return {
    tx,
    prisma: {
      userSettings: {
        findUnique: vi.fn(),
        upsert: vi.fn()
      },
      $transaction: vi.fn(async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx))
    }
  };
});

vi.mock("@/src/db/client", () => ({
  prisma: mocks.prisma
}));

function settingsRecord(dataMcpConnectionsJson: string) {
  return {
    modelProvider: "openai",
    modelName: "gpt-4o-mini",
    modelBaseUrl: "https://api.openai.com/v1",
    encryptedApiKey: null,
    apiKeyIv: null,
    apiKeyTag: null,
    apiKeyHint: null,
    dataMcpConnectionsJson
  };
}

describe("COROS settings sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SETTINGS_ENCRYPTION_KEY", "12345678901234567890123456789012");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetches the configured COROS MCP endpoint with stored auth and imports bridge data", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.userSettings.upsert).mockResolvedValue({} as never);

    await saveUserSettings("user-1", {
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
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(
      settingsRecord(String(upsertArg?.create?.dataMcpConnectionsJson ?? upsertArg?.update?.dataMcpConnectionsJson)) as never
    );
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const body = init && typeof init.body === "string" ? JSON.parse(init.body) : ({} as Record<string, unknown>);
      const method = (body as { method?: string }).method;

      if (method === "initialize") {
        return { ok: true, status: 200, json: async () => ({ jsonrpc: "2.0", id: (body as { id: unknown }).id, result: {} }) } as never;
      }

      if (method === "tools/list") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            jsonrpc: "2.0",
            id: (body as { id: unknown }).id,
            result: {
              tools: [
                { name: "get_activities", description: "Fetch activities" },
                { name: "get_sleep_records", description: "Fetch sleep data" },
                { name: "get_recovery_status", description: "Fetch recovery data" }
              ]
            }
          })
        } as never;
      }

      if (method === "tools/call") {
        const params = (body as { params?: { name?: string } }).params;
        const toolName = params?.name ?? "";

        if (toolName.includes("activit")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              jsonrpc: "2.0",
              id: (body as { id: unknown }).id,
              result: {
                data: [
                  {
                    labelId: "activity-from-mcp",
                    sportType: 100,
                    startTime: "2026-06-01T10:00:00+08:00",
                    endTime: "2026-06-01T10:45:00+08:00",
                    distanceKm: 8.2
                  }
                ]
              }
            })
          } as never;
        }

        if (toolName.includes("sleep")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              jsonrpc: "2.0",
              id: (body as { id: unknown }).id,
              result: { data: [{ date: "2026-06-02", durationMinutes: 410, score: 78 }] }
            })
          } as never;
        }

        if (toolName.includes("recovery")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              jsonrpc: "2.0",
              id: (body as { id: unknown }).id,
              result: { data: [{ date: "2026-06-02", recoveryPercent: 72, hrvMs: 55 }] }
            })
          } as never;
        }
      }

      return { ok: true, status: 200, json: async () => ({}) } as never;
    });

    const result = await syncCorosFromSettings("user-1");

    expect(fetch).toHaveBeenCalledWith(
      "https://mcp.example.test/coros",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer coros-token-123456"
        })
      })
    );
    expect(mocks.tx.activityRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ sourceId: "activity-from-mcp", userId: "user-1" })
      })
    );
    expect(mocks.tx.sleepRecord.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.tx.recoveryRecord.upsert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ activities: 1, sleep: 1, recovery: 1 });
  });

  it("requires a COROS MCP endpoint before syncing from settings", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(settingsRecord(JSON.stringify(defaultDataMcpConnections)) as never);

    await expect(syncCorosFromSettings("user-1")).rejects.toThrow("COROS MCP endpoint is not configured.");
    expect(fetch).not.toHaveBeenCalled();
  });
});
