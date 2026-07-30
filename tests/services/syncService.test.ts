/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { defaultDataMcpConnections } from "@/src/settings/defaults";
import { saveUserSettings } from "@/src/settings/service";
import { syncCorosFromSettings } from "@/src/services/syncService";

const mocks = vi.hoisted(() => {
  const tx = {
    activityRecord: { upsert: vi.fn() },
    sleepRecord: { upsert: vi.fn() },
    recoveryRecord: { upsert: vi.fn() },
    bodyProfile: { upsert: vi.fn() }
  };

  return {
    tx,
    prisma: {
      bodyProfile: { upsert: vi.fn() },
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00+08:00"));
    vi.stubEnv("SETTINGS_ENCRYPTION_KEY", "12345678901234567890123456789012");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
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
    const rpcResponse = (payload: unknown) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json", "mcp-session-id": "session-123" }),
        text: async () => JSON.stringify(payload)
      }) as never;

    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const body = init && typeof init.body === "string" ? JSON.parse(init.body) : ({} as Record<string, unknown>);
      const method = (body as { method?: string }).method;
      const id = (body as { id?: unknown }).id;

      if (method === "initialize") {
        return rpcResponse({ jsonrpc: "2.0", id, result: { protocolVersion: "2025-06-18" } });
      }

      if (method === "tools/list") {
        return rpcResponse({
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              { name: "get_activities", description: "Fetch activities" },
              { name: "get_sleep_records", description: "Fetch sleep data" },
              { name: "get_recovery_status", description: "Fetch recovery data" }
            ]
          }
        });
      }

      if (method === "tools/call") {
        const params = (body as { params?: { name?: string } }).params;
        const toolName = params?.name ?? "";

        if (toolName.includes("activit")) {
          return rpcResponse({
            jsonrpc: "2.0",
            id,
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
          });
        }

        if (toolName.includes("sleep")) {
          return rpcResponse({
            jsonrpc: "2.0",
            id,
            result: { data: [{ date: "2026-06-02", durationMinutes: 410, score: 78 }] }
          });
        }

        if (toolName.includes("recovery")) {
          return rpcResponse({
            jsonrpc: "2.0",
            id,
            result: { data: [{ date: "2026-06-02", recoveryPercent: 72, hrvMs: 55 }] }
          });
        }
      }

      return rpcResponse({ jsonrpc: "2.0", id, result: {} });
    });

    const result = await syncCorosFromSettings("user-1");
    const toolCalls = vi
      .mocked(fetch)
      .mock.calls.map(([, init]) => (init?.body && typeof init.body === "string" ? JSON.parse(init.body) : null))
      .filter((body): body is { method: string; params: { name: string; arguments: Record<string, unknown> } } => body?.method === "tools/call")
      .map((body) => body.params);

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
    expect(toolCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "get_activities",
          arguments: { startDate: "20260607", endDate: "20260620" }
        }),
        expect.objectContaining({
          name: "get_sleep_records",
          arguments: { days: 14, startDate: "20260607", endDate: "20260620" }
        }),
        expect.objectContaining({
          name: "get_recovery_status",
          arguments: { days: 14, startDate: "20260607", endDate: "20260620" }
        })
      ])
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

  it("parses SSE (text/event-stream) MCP responses and sends required headers", async () => {
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

    const sse = (payload: unknown) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/event-stream" }),
        text: async () => `event: message\ndata: ${JSON.stringify(payload)}\n\n`
      }) as never;

    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const body = init && typeof init.body === "string" ? JSON.parse(init.body) : ({} as Record<string, unknown>);
      const method = (body as { method?: string }).method;
      const id = (body as { id?: unknown }).id;

      if (method === "initialize") return sse({ jsonrpc: "2.0", id, result: {} });
      if (method === "tools/list") {
        return sse({ jsonrpc: "2.0", id, result: { tools: [{ name: "get_activities" }] } });
      }
      if (method === "tools/call") {
        return sse({
          jsonrpc: "2.0",
          id,
          result: { data: [{ labelId: "sse-activity", sportType: 100, startTime: "2026-06-01T10:00:00+08:00" }] }
        });
      }
      return sse({ jsonrpc: "2.0", id, result: {} });
    });

    const result = await syncCorosFromSettings("user-1");

    expect(fetch).toHaveBeenCalledWith(
      "https://mcp.example.test/coros",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json, text/event-stream",
          Authorization: "Bearer coros-token-123456"
        })
      })
    );
    expect(result.activities).toBe(1);
    expect(mocks.tx.activityRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ sourceId: "sse-activity" }) })
    );
  });

  it("re-initializes on HTTP 404 (lost session) and echoes the sticky cookie back", async () => {
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

    const json = (payload: unknown, headers: Record<string, string> = {}) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json", ...headers }),
        text: async () => JSON.stringify(payload)
      }) as never;

    let activityAttempts = 0;
    const cookieHeadersSeen: Array<string | null> = [];

    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      cookieHeadersSeen.push(headers.Cookie ?? null);

      const body = init && typeof init.body === "string" ? JSON.parse(init.body) : ({} as Record<string, unknown>);
      const method = (body as { method?: string }).method;
      const id = (body as { id?: unknown }).id;

      if (method === "initialize") {
        // Issue a sticky load-balancer cookie that the client must echo on later requests.
        return json({ jsonrpc: "2.0", id, result: {} }, { "set-cookie": "AWSALB=sticky-1; Path=/" });
      }
      if (method === "tools/list") {
        return json({ jsonrpc: "2.0", id, result: { tools: [{ name: "get_activities" }] } });
      }
      if (method === "tools/call") {
        activityAttempts += 1;
        if (activityAttempts === 1) {
          return {
            ok: false,
            status: 404,
            headers: new Headers({ "mcp-session-id": "lost" }),
            text: async () => '{"error":"Session not found"}'
          } as never;
        }
        return json({
          jsonrpc: "2.0",
          id,
          result: { data: [{ labelId: "retried-activity", sportType: 100, startTime: "2026-06-01T10:00:00+08:00" }] }
        });
      }
      return json({ jsonrpc: "2.0", id, result: {} });
    });

    const result = await syncCorosFromSettings("user-1");

    expect(result.activities).toBe(1);
    expect(mocks.tx.activityRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ sourceId: "retried-activity" }) })
    );
    // The activity tool was attempted twice (404 -> re-init -> success).
    expect(activityAttempts).toBe(2);
    // After the initialize Set-Cookie, later requests must carry the sticky cookie.
    expect(cookieHeadersSeen.some((value) => value === "AWSALB=sticky-1")).toBe(true);
  });

  it("drops a stale sticky cookie before re-initializing after a Java transport 404", async () => {
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

    const json = (payload: unknown, headers: Record<string, string> = {}) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json", ...headers }),
        text: async () => JSON.stringify(payload)
      }) as never;
    const javaTransport404 = {
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          stackTrace: [
            {
              methodName: "handlePost",
              fileName: "WebMvcStreamableServerTransportProvider.java",
              lineNumber: 365,
              className: "io.modelcontextprotocol.server.transport.WebMvcStreamableServerTransportProvider"
            }
          ]
        })
    } as never;

    let initializeCount = 0;
    let activityAttempts = 0;
    const initializeCookiesSeen: Array<string | null> = [];

    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const body = init && typeof init.body === "string" ? JSON.parse(init.body) : ({} as Record<string, unknown>);
      const method = (body as { method?: string }).method;
      const id = (body as { id?: unknown }).id;

      if (method === "initialize") {
        initializeCount += 1;
        initializeCookiesSeen.push(headers.Cookie ?? null);
        if (initializeCount === 1) {
          return json({ jsonrpc: "2.0", id, result: {} }, { "set-cookie": "AWSALB=stale; Path=/" });
        }
        if (headers.Cookie === "AWSALB=stale") {
          return javaTransport404;
        }
        return json({ jsonrpc: "2.0", id, result: {} }, { "set-cookie": "AWSALB=fresh; Path=/" });
      }

      if (method === "tools/list") {
        return json({ jsonrpc: "2.0", id, result: { tools: [{ name: "get_activities" }] } });
      }

      if (method === "tools/call") {
        activityAttempts += 1;
        if (activityAttempts === 1) return javaTransport404;
        return json({
          jsonrpc: "2.0",
          id,
          result: { data: [{ labelId: "fresh-session-activity", sportType: 100, startTime: "2026-06-01T10:00:00+08:00" }] }
        });
      }

      return json({ jsonrpc: "2.0", id, result: {} });
    });

    const result = await syncCorosFromSettings("user-1");

    expect(result.activities).toBe(1);
    expect(activityAttempts).toBe(2);
    expect(initializeCookiesSeen).toEqual([null, null, null]);
    expect(mocks.tx.activityRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ sourceId: "fresh-session-activity" }) })
    );
  });

  it("retries initialization after a transient Java transport 404", async () => {
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

    const json = (payload: unknown) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify(payload)
      }) as never;
    const javaTransport404 = {
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          stackTrace: [
            {
              methodName: "handlePost",
              fileName: "WebMvcStreamableServerTransportProvider.java",
              lineNumber: 365,
              className: "io.modelcontextprotocol.server.transport.WebMvcStreamableServerTransportProvider"
            }
          ]
        })
    } as never;

    let initializeCount = 0;

    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const body = init && typeof init.body === "string" ? JSON.parse(init.body) : ({} as Record<string, unknown>);
      const method = (body as { method?: string }).method;
      const id = (body as { id?: unknown }).id;

      if (method === "initialize") {
        initializeCount += 1;
        if (initializeCount === 1) return javaTransport404;
        return json({ jsonrpc: "2.0", id, result: {} });
      }
      if (method === "tools/list") {
        return json({ jsonrpc: "2.0", id, result: { tools: [{ name: "get_activities" }] } });
      }
      if (method === "tools/call") {
        return json({
          jsonrpc: "2.0",
          id,
          result: { data: [{ labelId: "after-init-retry", sportType: 100, startTime: "2026-06-01T10:00:00+08:00" }] }
        });
      }

      return json({ jsonrpc: "2.0", id, result: {} });
    });

    const result = await syncCorosFromSettings("user-1");

    expect(initializeCount).toBe(3);
    expect(result.activities).toBe(1);
    expect(mocks.tx.activityRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ sourceId: "after-init-retry" }) })
    );
  });

  it("prefers COROS sport records over training assessment tools for activities", async () => {
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

    const json = (payload: unknown) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify(payload)
      }) as never;
    const activityToolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const body = init && typeof init.body === "string" ? JSON.parse(init.body) : ({} as Record<string, unknown>);
      const method = (body as { method?: string }).method;
      const id = (body as { id?: unknown }).id;

      if (method === "initialize") return json({ jsonrpc: "2.0", id, result: {} });
      if (method === "tools/list") {
        return json({
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              { name: "_querytrainingloadassessment", inputSchema: { properties: { days: {} } } },
              {
                name: "_querysportrecords",
                inputSchema: {
                  properties: {
                    startDate: {},
                    endDate: {},
                    limit: {},
                    sportTypeCodes: {},
                    timezone: {},
                    locationKeyword: {},
                    minDistanceKm: {},
                    maxDistanceKm: {},
                    minDurationMinutes: {},
                    maxDurationMinutes: {},
                    maxAveragePace: {}
                  }
                }
              }
            ]
          }
        });
      }
      if (method === "tools/call") {
        const params = (body as { params?: { name?: string; arguments?: Record<string, unknown> } }).params;
        activityToolCalls.push({ name: String(params?.name ?? ""), arguments: params?.arguments ?? {} });
        if (params?.name === "_querysportrecords") {
          return json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(`Sport Records — 2026-06-07 to 2026-06-20 (1 records)
========================

1. Boxing — 2026-06-20
   Location: Boxing
   Duration: 1:00:29
 | Avg HR: 130 bpm | Calories: 385 kcal
   LabelId: sport-records-activity | SportType: 906`)
                }
              ]
            }
          });
        }
        return json({ jsonrpc: "2.0", id, result: { data: [] } });
      }

      return json({ jsonrpc: "2.0", id, result: {} });
    });

    const result = await syncCorosFromSettings("user-1");

    expect(activityToolCalls).toEqual([
      {
        name: "_querysportrecords",
        arguments: {
          startDate: "20260607",
          endDate: "20260620",
          limit: 20,
          sportTypeCodes: [65535],
          timezone: "Asia/Shanghai",
          locationKeyword: "",
          minDistanceKm: 0,
          maxDistanceKm: 0,
          minDurationMinutes: 0,
          maxDurationMinutes: 0,
          maxAveragePace: ""
        }
      }
    ]);
    expect(result.activities).toBe(1);
    expect(mocks.tx.activityRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ sourceId: "sport-records-activity" }) })
    );
  });

  it("imports COROS sleep and recovery text responses", async () => {
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

    const json = (payload: unknown) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify(payload)
      }) as never;

    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const body = init && typeof init.body === "string" ? JSON.parse(init.body) : ({} as Record<string, unknown>);
      const method = (body as { method?: string }).method;
      const id = (body as { id?: unknown }).id;

      if (method === "initialize") return json({ jsonrpc: "2.0", id, result: {} });
      if (method === "tools/list") {
        return json({
          jsonrpc: "2.0",
          id,
          result: {
            tools: [{ name: "querySleepData" }, { name: "queryRecoveryStatus" }]
          }
        });
      }
      if (method === "tools/call") {
        const params = (body as { params?: { name?: string } }).params;
        if (params?.name === "querySleepData") {
          return json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(`Sleep Data
========================

2026-06-08
Sleep Score: 78
Main Sleep: 7h 22min
Deep Sleep Ratio: 15%
Light Sleep Ratio: 58%
REM Ratio: 24%`)
                }
              ]
            }
          });
        }
        if (params?.name === "queryRecoveryStatus") {
          return json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(`Recovery Status
========================

Recovery: 94%
Level: Heavy training allowed
Estimated Full Recovery: 11h`)
                }
              ]
            }
          });
        }
      }

      return json({ jsonrpc: "2.0", id, result: {} });
    });

    const result = await syncCorosFromSettings("user-1");

    expect(result).toEqual({ activities: 0, sleep: 1, recovery: 1 });
    expect(mocks.tx.sleepRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ date: new Date("2026-06-08T00:00:00+08:00"), durationMinutes: 442, qualityScore: 78 })
      })
    );
    expect(mocks.tx.recoveryRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ date: new Date("2026-06-20T00:00:00+08:00"), recoveryPercent: 94 })
      })
    );
  });

  it("imports COROS resting heart rate, stress, and sleep HRV text responses", async () => {
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

    const json = (payload: unknown) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify(payload)
      }) as never;

    const textResult = (id: unknown, text: string) =>
      json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(text) }] } });

    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const body = init && typeof init.body === "string" ? JSON.parse(init.body) : ({} as Record<string, unknown>);
      const method = (body as { method?: string }).method;
      const id = (body as { id?: unknown }).id;

      if (method === "initialize") return json({ jsonrpc: "2.0", id, result: {} });
      if (method === "tools/list") {
        return json({
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              { name: "queryRecoveryStatus" },
              { name: "queryRestingHeartRate" },
              { name: "queryStressLevel" },
              { name: "querySleepHrv" }
            ]
          }
        });
      }
      if (method === "tools/call") {
        const params = (body as { params?: { name?: string } }).params;
        if (params?.name === "queryRecoveryStatus") {
          return textResult(id, `Recovery Status
========================

Recovery: 94%
Level: Heavy training allowed
Estimated Full Recovery: 11h`);
        }
        if (params?.name === "queryRestingHeartRate") {
          return textResult(id, `Resting Heart Rate — Last 14 days
========================

2026-06-20: 57 bpm
2026-06-19: 56 bpm`);
        }
        if (params?.name === "queryStressLevel") {
          return textResult(id, `Stress Level — Last 14 days
========================

2026-06-20:
Average Stress: 27 (Low)
Relaxed: No data

2026-06-19:
Average Stress: 33 (Low)`);
        }
        if (params?.name === "querySleepHrv") {
          return textResult(id, `Sleep HRV — 2026-06-14 to 2026-06-20
========================
Note: dates are wake-up days (each value comes from the night that ended that morning).

HRV Assessment — Last 7 days
========================

2026-06-20:
  HRV Avg: 36 ms — Normal
  Normal Range: 29 - 37 ms
  Baseline: 33 ms
2026-06-19:
  HRV Avg: 38 ms — Above normal
  Normal Range: 29 - 37 ms
  Baseline: 33 ms`);
        }
      }

      return json({ jsonrpc: "2.0", id, result: {} });
    });

    const result = await syncCorosFromSettings("user-1");

    expect(result).toEqual({ activities: 0, sleep: 0, recovery: 7 });
    expect(mocks.tx.recoveryRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ date: new Date("2026-06-20T00:00:00+08:00"), recoveryPercent: 94 })
      })
    );
    expect(mocks.tx.recoveryRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ date: new Date("2026-06-20T00:00:00+08:00"), restingHeartRateBpm: 57 })
      })
    );
    expect(mocks.tx.recoveryRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ date: new Date("2026-06-19T00:00:00+08:00"), stressLevel: 33 })
      })
    );
    expect(mocks.tx.recoveryRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ date: new Date("2026-06-20T00:00:00+08:00"), hrvMs: 36 })
      })
    );
  });

  it("uses isolated MCP sessions for activity and sleep tool calls", async () => {
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

    const json = (payload: unknown, headers: Record<string, string> = {}) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json", ...headers }),
        text: async () => JSON.stringify(payload)
      }) as never;
    const javaTransport404 = {
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () =>
        JSON.stringify({
          stackTrace: [
            {
              methodName: "handlePost",
              fileName: "WebMvcStreamableServerTransportProvider.java",
              lineNumber: 365,
              className: "io.modelcontextprotocol.server.transport.WebMvcStreamableServerTransportProvider"
            }
          ]
        })
    } as never;

    let initializeCount = 0;
    const toolSessionIds: string[] = [];

    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const body = init && typeof init.body === "string" ? JSON.parse(init.body) : ({} as Record<string, unknown>);
      const method = (body as { method?: string }).method;
      const id = (body as { id?: unknown }).id;

      if (method === "initialize") {
        initializeCount += 1;
        return json({ jsonrpc: "2.0", id, result: {} }, { "mcp-session-id": `session-${initializeCount}` });
      }

      if (method === "tools/list") {
        return json({
          jsonrpc: "2.0",
          id,
          result: { tools: [{ name: "_querysportrecords" }, { name: "querySleepData" }] }
        });
      }

      if (method === "tools/call") {
        const params = (body as { params?: { name?: string } }).params;
        const sessionId = headers["Mcp-Session-Id"];
        toolSessionIds.push(`${params?.name ?? ""}:${sessionId ?? ""}`);

        if (params?.name === "_querysportrecords") {
          return json({
            jsonrpc: "2.0",
            id,
            result: {
              data: [
                {
                  labelId: "isolated-activity",
                  sportType: 906,
                  startTime: "2026-06-20T06:00:00+08:00",
                  endTime: "2026-06-20T07:00:00+08:00"
                }
              ]
            }
          });
        }

        if (params?.name === "querySleepData") {
          if (sessionId !== "session-3") return javaTransport404;
          return json({
            jsonrpc: "2.0",
            id,
            result: { data: [{ date: "2026-06-21", durationMinutes: 376, score: 75 }] }
          });
        }
      }

      return json({ jsonrpc: "2.0", id, result: {} });
    });

    const result = await syncCorosFromSettings("user-1");

    expect(result).toEqual({ activities: 1, sleep: 1, recovery: 0 });
    expect(toolSessionIds).toEqual(["_querysportrecords:session-2", "querySleepData:session-3"]);
    expect(mocks.tx.sleepRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ date: new Date("2026-06-21T00:00:00+08:00"), durationMinutes: 376, qualityScore: 75 })
      })
    );
  });

  it("imports COROS user profile text into the body profile", async () => {
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

    const json = (payload: unknown) =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify(payload)
      }) as never;

    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const body = init && typeof init.body === "string" ? JSON.parse(init.body) : ({} as Record<string, unknown>);
      const method = (body as { method?: string }).method;
      const id = (body as { id?: unknown }).id;

      if (method === "initialize") return json({ jsonrpc: "2.0", id, result: {} });
      if (method === "tools/list") {
        return json({ jsonrpc: "2.0", id, result: { tools: [{ name: "queryUserInfo" }] } });
      }
      if (method === "tools/call") {
        return json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(`User Profile Information
========================

Height: 167.0 cm
Weight: 62.0 kg
Birthday: 1995-01-20 (Age: 31)
Gender: Male
Nickname: p.h`)
              }
            ]
          }
        });
      }

      return json({ jsonrpc: "2.0", id, result: {} });
    });

    await syncCorosFromSettings("user-1");

    expect(mocks.tx.bodyProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        update: expect.objectContaining({
          heightCm: 167,
          weightKg: 62,
          birthday: new Date("1995-01-20T00:00:00+08:00"),
          sex: "male"
        })
      })
    );
  });

  it("requires a COROS MCP endpoint before syncing from settings", async () => {
    vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(settingsRecord(JSON.stringify(defaultDataMcpConnections)) as never);

    await expect(syncCorosFromSettings("user-1")).rejects.toThrow("COROS MCP endpoint is not configured.");
    expect(fetch).not.toHaveBeenCalled();
  });
});
